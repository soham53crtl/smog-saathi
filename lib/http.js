// Request and response helpers shared by every route.
import {HEADERS, UPSTREAM_TIMEOUT_MS, trustProxy} from "./config.js";
import {HttpError} from "./errors.js";

/** @typedef {import("node:http").IncomingMessage & {body?: unknown}} Req */
/** @typedef {import("node:http").ServerResponse} Res */

export const clientIp = (/** @type {Req} */ req) => (trustProxy() && String(req.headers["x-forwarded-for"] ?? "").split(",")[0].trim()) || req.socket.remoteAddress;

export const send = (/** @type {Res} */ res, /** @type {number} */ status, /** @type {unknown} */ body) => {
  res.writeHead(status, {...HEADERS, "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store"});
  res.end(JSON.stringify(body));
};

/** Vercel pre-parses JSON bodies onto req.body (and throws on invalid JSON); plain Node does not. */
function preParsedBody(/** @type {Req} */ req) {
  try { return req.body; } catch { throw new HttpError(400, "Invalid JSON."); }
}
export async function readJson(/** @type {Req} */ req, /** @type {number} */ maxBytes) {
  const pre = preParsedBody(req);
  if (pre !== undefined) {
    const raw = typeof pre === "string" ? pre : Buffer.isBuffer(pre) ? pre.toString("utf8") : JSON.stringify(pre);
    if (raw.length > maxBytes) throw new HttpError(413, "Request too large.");
    if (typeof pre === "object" && !Buffer.isBuffer(pre)) return pre;
    try { return JSON.parse(raw); } catch { throw new HttpError(400, "Invalid JSON."); }
  }
  let raw = "";
  for await (const chunk of req) {
    raw += chunk;
    if (raw.length > maxBytes) throw new HttpError(413, "Request too large.");
  }
  try { return JSON.parse(raw); } catch { throw new HttpError(400, "Invalid JSON."); }
}
export async function getJson(/** @type {string} */ url) {
  let r;
  try { r = await fetch(url, {signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS)}); } catch { throw new HttpError(502, "Live air-quality data is unavailable right now."); }
  if (!r.ok) throw new HttpError(502, "Live air-quality data is unavailable right now.");
  return r.json();
}
