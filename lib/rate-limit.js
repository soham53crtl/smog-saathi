import {aiDailyLimit} from "./config.js";

/** @type {Map<string, number[]>} */
const hits = new Map();
/** Sliding-window limiter: true if `ip` may make another request. */
export function allow(/** @type {string} */ ip, now = Date.now(), limit = 10, windowMs = 60000) {
  if (hits.size > 5000) {
    hits.clear();
  }
  const recent = (hits.get(ip) || []).filter(t => now - t < windowMs);
  const ok = recent.length < limit;
  if (ok) {
    recent.push(now);
  }
  hits.set(ip, recent);
  return ok;
}
/** Test helper: forget all request counts. */
export function resetRateLimits() {
  hits.clear();
}

/* ---------- Daily AI budget ---------- */
let budget = {day: "", used: 0};
/** Count one AI call against today's budget; false once the limit is reached. */
export function spendAi(now = Date.now(), limit = aiDailyLimit()) {
  const day = new Date(now).toISOString().slice(0, 10);
  if (budget.day !== day) {
    budget = {day, used: 0};
  }
  if (budget.used >= limit) {
    return false;
  }
  budget.used++;
  return true;
}
