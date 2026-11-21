// The three API routes and the request handler used by both the local server and Vercel.
import {chatSystemPrompt, cleanText, emergencyNotice, normalise, promptFor, sanitizeMessages} from "../src/logic.js";
import {lookupAqi} from "./aqi-service.js";
import {CHAT_BODY, LIMITS, PLAN_BODY} from "./config.js";
import {HttpError} from "./errors.js";
import {clientIp, readJson, send} from "./http.js";
import {llm} from "./llm.js";
import {allow} from "./rate-limit.js";
import {loadStatic, sendStatic, staticFileFor} from "./static.js";

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
    const file = req.method === "GET" ? staticFileFor(url.pathname) : undefined;
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
