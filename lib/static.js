// Serves the browser app: index.html and everything under src/. Nothing else is ever served.
import {readdirSync} from "node:fs";
import {readFile} from "node:fs/promises";
import {createHash} from "node:crypto";
import {gzipSync} from "node:zlib";
import {extname, join} from "node:path";
import {fileURLToPath} from "node:url";
import {HEADERS, MIME} from "./config.js";

/** @typedef {{body: Buffer, gzip: Buffer, etag: string, type: string}} StaticEntry */

const ROOT = fileURLToPath(new URL("..", import.meta.url));

/** @type {Map<string, string> | null} */
let browserFiles = null;
/** URL path -> file path, built once from the files on disk. */
function whitelist() {
  if (!browserFiles) {
    browserFiles = new Map([["/", "index.html"], ["/index.html", "index.html"]]);
    for (const entry of readdirSync(join(ROOT, "src"), {recursive: true})) {
      const name = String(entry).replaceAll("\\", "/");
      if (name.endsWith(".js") || name.endsWith(".css")) browserFiles.set(`/src/${name}`, `src/${name}`);
    }
  }
  return browserFiles;
}
/** @returns {string | undefined} the file to serve for a URL path, if it is a browser asset. */
export const staticFileFor = (/** @type {string} */ urlPath) => whitelist().get(urlPath);

/* Read once, gzip once, revalidate with ETag. */
/** @type {Map<string, StaticEntry>} */
const cache = new Map();
export async function loadStatic(/** @type {string} */ file) {
  let entry = cache.get(file);
  if (!entry) {
    const body = await readFile(join(ROOT, file));
    entry = {body, gzip: gzipSync(body), etag: `"${createHash("sha1").update(body).digest("hex").slice(0, 16)}"`, type: MIME[extname(file)]};
    cache.set(file, entry);
  }
  return entry;
}
export function sendStatic(/** @type {import("./http.js").Req} */ req, /** @type {import("./http.js").Res} */ res, /** @type {StaticEntry} */ entry) {
  /** @type {Record<string, string>} */
  const headers = {...HEADERS, "Content-Type": entry.type, ETag: entry.etag, "Cache-Control": "no-cache", Vary: "Accept-Encoding"};
  if (req.headers["if-none-match"] === entry.etag) { res.writeHead(304, headers); return res.end(); }
  const gzip = /\bgzip\b/.test(String(req.headers["accept-encoding"] ?? ""));
  if (gzip) headers["Content-Encoding"] = "gzip";
  res.writeHead(200, headers);
  res.end(gzip ? entry.gzip : entry.body);
}
