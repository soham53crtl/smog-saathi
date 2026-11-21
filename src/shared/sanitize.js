// Untrusted input in, safe values out: profile fields, free text and chat history.
import {COMMUTES, COOKING, DEFAULT_AQI, HEATING, LANGS, MAX_AQI, MAX_CHAT_TURNS, MAX_KM, MAX_MESSAGE, MAX_TEXT} from "./constants.js";
import {clamp, toNum} from "./numbers.js";
/** @typedef {import("./types.js").Profile} Profile */

/** Keep letters (any script), combining marks, digits and basic punctuation only. */
export function cleanText(/** @type {unknown} */ s, max = MAX_TEXT) {
  return String(s ?? "").replace(/[^\p{L}\p{M}\p{N} ,.-]/gu, "").trim().slice(0, max);
}

/**
 * Validate and coerce untrusted input into a safe {@link Profile}.
 * @param {any} input
 * @returns {Profile}
 */
export function normalise(input) {
  const raw = input ?? {};
  const pick = (/** @type {any} */ v, /** @type {string[]} */ allowed, /** @type {string} */ dflt) => (allowed.includes(v) ? v : dflt);
  return {
    city: cleanText(raw.city) || "your area",
    aqi: clamp(Math.round(toNum(raw.aqi, DEFAULT_AQI)), 0, MAX_AQI),
    kids: !!raw.kids, elderly: !!raw.elderly, resp: !!raw.resp,
    commute: pick(raw.commute, COMMUTES, "car"),
    km: clamp(toNum(raw.km, 0), 0, MAX_KM),
    cooking: pick(raw.cooking, COOKING, "lpg"),
    heating: pick(raw.heating, HEATING, "layers"),
    purifier: !!raw.purifier,
    lang: pick(raw.lang, LANGS, "English")
  };
}

/** Strip control characters and angle brackets, collapse whitespace, cap length. */
export function cleanMessage(/** @type {unknown} */ s) {
  return String(s ?? "").replace(/[\p{Cc}<>]/gu, " ").replace(/\s+/g, " ").trim().slice(0, MAX_MESSAGE);
}
/** Keep the last few valid turns, starting with a user turn. @returns {{role: "user"|"assistant", content: string}[]} */
export function sanitizeMessages(/** @type {unknown} */ msgs) {
  if (!Array.isArray(msgs)) return [];
  const clean = msgs.slice(-MAX_CHAT_TURNS)
    .map(/** @returns {{role: "user"|"assistant", content: string}} */ m => ({role: m?.role === "assistant" ? "assistant" : "user", content: cleanMessage(m?.content)}))
    .filter(m => m.content);
  while (clean.length && clean[0].role !== "user") clean.shift();
  return clean;
}
