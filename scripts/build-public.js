// Copies only the browser assets into public/, which Vercel serves as static files.
import {cpSync, mkdirSync, rmSync} from "node:fs";

rmSync("public", {recursive: true, force: true});
mkdirSync("public", {recursive: true});
cpSync("index.html", "public/index.html");
cpSync("src", "public/src", {recursive: true});
console.log("public/ ready");
