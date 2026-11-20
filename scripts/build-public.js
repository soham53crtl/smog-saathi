// Copies only the browser assets into public/, which Vercel serves as static files.
import {cpSync, mkdirSync, rmSync} from "node:fs";

rmSync("public", {recursive: true, force: true});
mkdirSync("public/src", {recursive: true});
cpSync("index.html", "public/index.html");
for (const f of ["app.js", "logic.js", "styles.css"]) cpSync(`src/${f}`, `public/src/${f}`);
console.log("public/ ready");
