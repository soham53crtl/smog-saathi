// Entry point for the local server (`npm start`).
// The request handler lives in lib/ and is shared with the Vercel functions in api/.
import http from "node:http";
import {fileURLToPath} from "node:url";
import {handler} from "./lib/routes.js";

export {handler} from "./lib/routes.js";
export {lookupAqi} from "./lib/aqi-service.js";
export {allow, spendAi} from "./lib/rate-limit.js";

export const server = http.createServer(handler);

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const port = process.env.PORT || 3000;
  server.listen(port, () => console.log(`Smog Saathi on http://localhost:${port}`));
}
