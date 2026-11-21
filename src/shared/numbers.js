// Small numeric helpers.

export const clamp = (n, lo, hi) => Math.min(hi, Math.max(lo, n));

/** Parse a number, returning `fallback` for anything non-finite. */
export function toNum(value, fallback) {
  const n = Number.parseFloat(value);
  return Number.isFinite(n) ? n : fallback;
}
