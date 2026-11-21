// DOM helpers. Text is always set with textContent, never innerHTML.
import {normalise} from "../logic.js";

/** Look up an element that is known to exist in index.html. @returns {any} */
export const $ = (/** @type {string} */ id) => document.getElementById(id);
/**
 * Create an element with an optional class and text (set via textContent).
 * @param {string} tag
 * @param {string | null} [cls]
 * @param {string | null} [text]
 */
export function el(tag, cls, text) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text !== undefined && text !== null) e.textContent = text;
  return e;
}
export function readForm() {
  return normalise({
    city: $("city").value, aqi: $("aqi").value, kids: $("kids").checked, elderly: $("elderly").checked, resp: $("resp").checked,
    commute: $("commute").value, km: $("km").value, cooking: $("cooking").value, heating: $("heating").value,
    purifier: $("purifier").checked, lang: $("lang").value
  });
}
/**
 * POST JSON and return {ok, text, error} from the response body.
 * @param {string} url
 * @param {unknown} payload
 * @param {AbortSignal} [signal]
 */
export async function postJson(url, payload, signal) {
  const r = await fetch(url, {method: "POST", headers: {"Content-Type": "application/json"}, body: JSON.stringify(payload), signal});
  const d = await r.json().catch(() => ({}));
  return {ok: r.ok, text: d.text, error: d.error};
}
export function setBusy(/** @type {HTMLElement} */ node, /** @type {boolean} */ busy) { node.setAttribute("aria-busy", String(busy)); }
