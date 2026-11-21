// Shared JSDoc types (type-checked by `npm run typecheck`).

/**
 * @typedef {Object} Profile
 * @property {string} city
 * @property {number} aqi        Indian CPCB scale, 0-999
 * @property {boolean} kids
 * @property {boolean} elderly
 * @property {boolean} resp      asthma, heart or lung condition at home
 * @property {string} commute    key of EF
 * @property {number} km         one-way distance
 * @property {"lpg"|"png"|"induction"|"biomass"} cooking
 * @property {"layers"|"electric"|"burn"} heating
 * @property {boolean} purifier
 * @property {string} lang       one of LANGS
 */
/** @typedef {{group: string, title: string, why: string, impact: string}} Action */

export {};
