// Small numeric helpers.

/** @type {(n: number, lo: number, hi: number) => number} */
export const clamp = (n, lo, hi) => Math.min(hi, Math.max(lo, n));

/** Parse a number, returning `fallback` for anything non-finite. */
export function toNum(/** @type {unknown} */ value, /** @type {number} */ fallback) {
  const n = Number.parseFloat(String(value));
  return Number.isFinite(n) ? n : fallback;
}
