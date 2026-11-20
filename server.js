// Zero-dependency Node server: static app + /api/aqi (live air quality), /api/plan and /api/chat (LLM proxy: Gemini, xAI Grok or Groq).
import http from "node:http";
import {readFile} from "node:fs/promises";
import {extname, join} from "node:path";
import {fileURLToPath} from "node:url";
import {createHash} from "node:crypto";
import {gzipSync} from "node:zlib";
import {chatSystemPrompt, cleanMessage, cleanText, emergencyNotice, normalise, pm25ToAqi, promptFor, sanitizeMessages} from "./src/logic.js";

const ROOT = fileURLToPath(new URL(".", import.meta.url));
const PORT = process.env.PORT || 3000;
const MAX_TOKENS = 2048; // headroom: reasoning models spend tokens thinking before they answer
const TEMPERATURE = 0.4;
const MAX_REPLY = 2500;
const AI_DAILY_LIMIT = Number(process.env.AI_DAILY_LIMIT) || 500; // protects the Gemini key from abuse
const PLAN_BODY = 2048;
const CHAT_BODY = 8192;
/** Requests per minute per client, per route. */
const LIMITS = {"GET /api/aqi": 30, "POST /api/plan": 10, "POST /api/chat": 10};
const AQI_CACHE_MS = 10 * 60 * 1000;
const UPSTREAM_TIMEOUT_MS = 20000;
const UNAVAILABLE = "The AI service is unavailable right now.";

const STATIC = {"/": "index.html", "/index.html": "index.html", "/src/app.js": "src/app.js", "/src/logic.js": "src/logic.js", "/src/styles.css": "src/styles.css"};
const MIME = {".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8"};
const HEADERS = {"Content-Security-Policy": "default-src 'self'; connect-src 'self'; frame-ancestors 'none'", "X-Content-Type-Options": "nosniff", "Referrer-Policy": "no-referrer", "Permissions-Policy": "camera=(), microphone=(), geolocation=()", "Cross-Origin-Opener-Policy": "same-origin"};

class HttpError extends Error {
  /** @param {number} status @param {string} message */
  constructor(status, message) { super(message); this.status = status; }
}

/* ---------- Rate limiting ---------- */
const hits = new Map();
/** Sliding-window limiter: true if `ip` may make another request. */
export function allow(ip, now = Date.now(), limit = 10, windowMs = 60000) {
  if (hits.size > 5000) hits.clear();
  const recent = (hits.get(ip) || []).filter(t => now - t < windowMs);
  const ok = recent.length < limit;
  if (ok) recent.push(now);
  hits.set(ip, recent);
  return ok;
}
const clientIp = req => (process.env.TRUST_PROXY === "1" && String(req.headers["x-forwarded-for"] ?? "").split(",")[0].trim()) || req.socket.remoteAddress;

/* ---------- Helpers ---------- */
const send = (res, status, body) => {
  res.writeHead(status, {...HEADERS, "Content-Type": "application/json", "Cache-Control": "no-store"});
  res.end(JSON.stringify(body));
};

/* ---------- Static files: read once, gzip once, revalidate with ETag ---------- */
const staticCache = new Map();
async function loadStatic(file) {
  let entry = staticCache.get(file);
  if (!entry) {
    const body = await readFile(join(ROOT, file));
    entry = {body, gzip: gzipSync(body), etag: `"${createHash("sha1").update(body).digest("hex").slice(0, 16)}"`, type: MIME[extname(file)]};
    staticCache.set(file, entry);
  }
  return entry;
}
function sendStatic(req, res, entry) {
  const headers = {...HEADERS, "Content-Type": entry.type, ETag: entry.etag, "Cache-Control": "no-cache", Vary: "Accept-Encoding"};
  if (req.headers["if-none-match"] === entry.etag) { res.writeHead(304, headers); return res.end(); }
  const gzip = /\bgzip\b/.test(String(req.headers["accept-encoding"] ?? ""));
  if (gzip) headers["Content-Encoding"] = "gzip";
  res.writeHead(200, headers);
  res.end(gzip ? entry.gzip : entry.body);
}

/* ---------- Daily AI budget ---------- */
let budget = {day: "", used: 0};
/** Count one AI call against today's budget; false once the limit is reached. */
export function spendAi(now = Date.now(), limit = AI_DAILY_LIMIT) {
  const day = new Date(now).toISOString().slice(0, 10);
  if (budget.day !== day) budget = {day, used: 0};
  if (budget.used >= limit) return false;
  budget.used++;
  return true;
}

/** Vercel pre-parses JSON bodies onto req.body (and throws on invalid JSON); plain Node does not. */
function preParsedBody(req) {
  try { return req.body; } catch { throw new HttpError(400, "Invalid JSON."); }
}
async function readJson(req, maxBytes) {
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
async function getJson(url) {
  let r;
  try { r = await fetch(url, {signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS)}); } catch { throw new HttpError(502, "Live air-quality data is unavailable right now."); }
  if (!r.ok) throw new HttpError(502, "Live air-quality data is unavailable right now.");
  return r.json();
}

/* ---------- Live air quality (Open-Meteo, no key needed) ---------- */
const aqiCache = new Map();
const inflight = new Map();
/** Geocode a city and estimate its Indian AQI from live PM2.5. Cached for 10 minutes; concurrent lookups share one upstream call. */
export async function lookupAqi(city, now = Date.now()) {
  const key = city.toLowerCase();
  const hit = aqiCache.get(key);
  if (hit && now - hit.at < AQI_CACHE_MS) return hit.value;
  let pending = inflight.get(key);
  if (!pending) {
    pending = fetchAqi(city).finally(() => inflight.delete(key));
    inflight.set(key, pending);
  }
  const value = await pending;
  if (aqiCache.size > 200) aqiCache.clear();
  aqiCache.set(key, {at: now, value});
  return value;
}
async function fetchAqi(city) {
  const geo = await getJson(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(city)}&count=1&language=en&format=json`);
  const place = geo.results?.[0];
  if (!place) throw new HttpError(404, "City not found. Check the spelling or enter the AQI manually.");
  const air = await getJson(`https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${Number(place.latitude)}&longitude=${Number(place.longitude)}&current=pm2_5`);
  const pm = Number(air.current?.pm2_5);
  if (!Number.isFinite(pm)) throw new HttpError(502, "No live PM2.5 reading for this place. Enter the AQI manually.");
  return {place: [place.name, place.admin1].filter(Boolean).join(", "), pm25: Math.round(pm), aqi: pm25ToAqi(pm)};
}

/* ---------- LLM providers: Gemini, xAI Grok, Groq (set the matching *_API_KEY) ---------- */
const PROVIDERS = {
  gemini: {keyEnv: "GEMINI_API_KEY", model: "gemini-2.5-flash"},
  xai: {keyEnv: "XAI_API_KEY", model: "grok-4", url: "https://api.x.ai/v1/chat/completions"},
  groq: {keyEnv: "GROQ_API_KEY", model: "openai/gpt-oss-120b", url: "https://api.groq.com/openai/v1/chat/completions"}
};
const requested = process.env.LLM_PROVIDER ?? "";
const PROVIDER = requested in PROVIDERS ? requested : (Object.keys(PROVIDERS).find(n => process.env[PROVIDERS[n].keyEnv]) ?? "gemini");
const CONFIG = PROVIDERS[PROVIDER];
const KEY = process.env[CONFIG.keyEnv];
const MODEL = process.env.LLM_MODEL || (PROVIDER === "gemini" && process.env.GEMINI_MODEL) || CONFIG.model;

const SHOW_PROVIDER_DETAIL = process.env.NODE_ENV !== "production"; // local debugging only
/** Extract the human-readable message from a provider error body. */
function providerDetail(raw) {
  try {
    const j = JSON.parse(raw);
    return cleanMessage(j.error?.message ?? j.error ?? j.message ?? raw);
  } catch { return cleanMessage(raw); }
}
/** Client-safe explanation for a provider error. In production the provider's own text stays in the server log. */
function upstreamMessage(status, raw) {
  let msg = UNAVAILABLE;
  if (status === 401 || status === 403) msg = "The AI provider rejected the API key or account. Check the key and that the account has credits.";
  else if (status === 404) msg = "The AI model was not found. Set LLM_MODEL to a model your account can use.";
  else if (status === 429) msg = "The AI provider is rate-limiting or out of credits. Try again shortly.";
  return SHOW_PROVIDER_DETAIL && raw ? `${msg} (Provider ${status}: ${providerDetail(raw)})` : msg;
}

/** @typedef {{role: "user"|"assistant", content: string}} Turn */
/** @param {string|undefined} system @param {Turn[]} messages */
function geminiRequest(system, messages) {
  /** @type {Record<string, unknown>} */
  const body = {
    contents: messages.map(m => ({role: m.role === "assistant" ? "model" : "user", parts: [{text: m.content}]})),
    generationConfig: {maxOutputTokens: MAX_TOKENS, temperature: TEMPERATURE}
  };
  if (system) body.systemInstruction = {parts: [{text: system}]};
  return {url: `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(MODEL)}:generateContent`, headers: {"x-goog-api-key": KEY}, body};
}
/** OpenAI-compatible chat completions (xAI Grok, Groq). @param {string|undefined} system @param {Turn[]} messages */
function openAiRequest(system, messages) {
  return {
    url: CONFIG.url, headers: {Authorization: `Bearer ${KEY}`},
    body: {
      model: MODEL, max_tokens: MAX_TOKENS, temperature: TEMPERATURE,
      ...(PROVIDER === "groq" && MODEL.startsWith("openai/gpt-oss") ? {reasoning_effort: "low"} : {}),
      messages: [...(system ? [{role: "system", content: system}] : []), ...messages]
    }
  };
}
/** @param {{system?: string, messages: Turn[]}} args */
async function llm({system, messages}) {
  if (!KEY) throw new HttpError(503, `AI is not configured on this server (set ${CONFIG.keyEnv}). The rule-based plan above still works.`);
  if (!spendAi()) throw new HttpError(429, "Today’s AI limit has been reached. The rule-based plan above still works.");
  const req = PROVIDER === "gemini" ? geminiRequest(system, messages) : openAiRequest(system, messages);
  let r;
  try {
    r = await fetch(req.url, {method: "POST", signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS), headers: {"Content-Type": "application/json", ...req.headers}, body: JSON.stringify(req.body)});
  } catch (e) {
    console.error(`[${PROVIDER}] request failed: ${e instanceof Error ? e.message : e}`);
    throw new HttpError(502, UNAVAILABLE);
  }
  if (!r.ok) {
    const raw = (await r.text().catch(() => "")).slice(0, 500);
    console.error(`[${PROVIDER}] model ${MODEL} returned ${r.status}: ${raw}`);
    throw new HttpError(502, upstreamMessage(r.status, raw));
  }
  const d = await r.json();
  const gemini = PROVIDER === "gemini";
  const text = String(gemini
    ? (d.candidates?.[0]?.content?.parts ?? []).map(x => x.text || "").join("")
    : d.choices?.[0]?.message?.content ?? "");
  const cutOff = gemini ? d.candidates?.[0]?.finishReason === "MAX_TOKENS" : d.choices?.[0]?.finish_reason === "length";
  if (cutOff) console.error(`[${PROVIDER}] reply hit the token limit (${MAX_TOKENS})`);
  return text ? text.slice(0, MAX_REPLY) + (cutOff ? "\n\n[The reply was cut short. Press the button again for a full answer.]" : "") : "No answer was generated.";
}

/* ---------- Routes ---------- */
const ROUTES = {
  "GET /api/aqi": async (_req, url) => {
    const city = cleanText(url.searchParams.get("city"));
    if (!city) throw new HttpError(400, "Enter a city first.");
    return lookupAqi(city);
  },
  "POST /api/plan": async req => ({text: await llm({messages: [{role: "user", content: promptFor(normalise(await readJson(req, PLAN_BODY)))}]})}),
  "POST /api/chat": async req => {
    const body = await readJson(req, CHAT_BODY);
    const messages = sanitizeMessages(body?.messages);
    if (messages.at(-1)?.role !== "user") throw new HttpError(400, "Send a question first.");
    // Fixed emergency guidance goes first and survives a model failure.
    const notice = emergencyNotice(messages.at(-1)?.content);
    try {
      const reply = await llm({system: chatSystemPrompt(normalise(body.profile)), messages});
      return {text: notice ? `${notice}\n\n${reply}` : reply};
    } catch (e) {
      if (notice) return {text: notice};
      throw e;
    }
  }
};

/** Request handler shared by the local server and the Vercel functions in api/. */
export async function handler(req, res) {
  try {
    const url = new URL(req.url ?? "/", "http://localhost");
    const file = req.method === "GET" ? STATIC[url.pathname] : undefined;
    if (file) return sendStatic(req, res, await loadStatic(file));
    const routeKey = `${req.method} ${url.pathname}`;
    const route = ROUTES[routeKey];
    if (!route) throw new HttpError(404, "Not found");
    if (!allow(`${clientIp(req)} ${routeKey}`, Date.now(), LIMITS[routeKey])) throw new HttpError(429, "Too many requests. Please wait a minute.");
    send(res, 200, await route(req, url));
  } catch (e) {
    if (e instanceof HttpError) return send(res, e.status, {error: e.message});
    console.error(e);
    send(res, 500, {error: "Something went wrong."});
  }
}
export const server = http.createServer(handler);
if (process.argv[1] === fileURLToPath(import.meta.url)) server.listen(PORT, () => console.log(`Smog Saathi on http://localhost:${PORT}`));
