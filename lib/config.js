// Constants and environment-driven settings. Environment values are read at call time,
// so tests and hosting platforms can change them without re-importing modules.
export const MAX_REPLY = 2500;
export const MAX_TOKENS = 2048; // headroom: reasoning models spend tokens thinking before they answer
export const TEMPERATURE = 0.4;
export const PLAN_BODY = 2048;
export const CHAT_BODY = 8192;
export const AQI_CACHE_MS = 10 * 60 * 1000;
export const UPSTREAM_TIMEOUT_MS = 20000;
export const UNAVAILABLE = "The AI service is unavailable right now.";

/** Requests per minute per client, per route. */
/** @type {Record<string, number>} */
export const LIMITS = {"GET /api/aqi": 30, "POST /api/plan": 10, "POST /api/chat": 10};

/** @type {Record<string, string>} */
export const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8"
};
export const HEADERS = {
  "Content-Security-Policy": "default-src 'self'; connect-src 'self'; frame-ancestors 'none'",
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "no-referrer",
  "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
  "Cross-Origin-Opener-Policy": "same-origin"
};

/** @type {Record<string, {keyEnv: string, model: string, url?: string}>} */
const PROVIDERS = {
  gemini: {keyEnv: "GEMINI_API_KEY", model: "gemini-2.5-flash"},
  xai: {keyEnv: "XAI_API_KEY", model: "grok-4", url: "https://api.x.ai/v1/chat/completions"},
  groq: {
    keyEnv: "GROQ_API_KEY",
    model: "openai/gpt-oss-120b",
    url: "https://api.groq.com/openai/v1/chat/completions"
  }
};

export const aiDailyLimit = () => Number(process.env.AI_DAILY_LIMIT) || 500; // protects the API key from abuse
export const trustProxy = () => process.env.TRUST_PROXY === "1";
export const showProviderDetail = () => process.env.NODE_ENV !== "production"; // local debugging only

/**
 * Which LLM to call: LLM_PROVIDER if valid, otherwise the first provider that has a key.
 * @returns {{name: string, keyEnv: string, url?: string, key?: string, model: string}}
 */
export function llmSettings() {
  const requested = process.env.LLM_PROVIDER ?? "";
  const name = Object.hasOwn(PROVIDERS, requested)
    ? requested
    : (Object.keys(PROVIDERS).find(n => process.env[PROVIDERS[n].keyEnv]) ?? "gemini");
  const {keyEnv, url, model} = PROVIDERS[name];
  return {
    name,
    keyEnv,
    url,
    key: process.env[keyEnv],
    model: process.env.LLM_MODEL || (name === "gemini" && process.env.GEMINI_MODEL) || model
  };
}
