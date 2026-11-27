// Rough, assumption-labelled impact estimates shown next to the plan.
import {EF, WORKING_DAYS} from "./constants.js";
import {aqiToPm25} from "./aqi.js";
/** @typedef {import("./types.js").Profile} Profile */

/** Monthly kg CO2 avoided by switching modes; `km` is one way. Never negative. */
export function monthlyCO2Saving(
  /** @type {string} */ from,
  /** @type {string} */ to,
  /** @type {number} */ km,
  days = WORKING_DAYS
) {
  const perKm = (EF[from] ?? 0) - (EF[to] ?? 0);
  return Math.max(0, Math.round(perKm * km * 2 * days * 10) / 10);
}

/* ---------- Impact estimates ---------- */
/** Illustrative assumptions behind every impact number; shown to the user. */
export const ASSUMPTIONS = {
  infiltration: 0.6,
  filterRemoval: 0.5,
  maskPass: 0.05,
  whoPm25: 15,
  households: 20
};

/** @param {Profile} p */
export function estimateImpact(p) {
  const a = ASSUMPTIONS;
  const outdoor = aqiToPm25(p.aqi);
  const indoor = Math.round(outdoor * a.infiltration);
  const alt = p.commute === "car" ? "metro" : p.commute === "bike" ? "bus" : null;
  const co2 = alt ? monthlyCO2Saving(p.commute, alt, p.km) : 0;
  return {
    outdoor,
    indoor,
    withFilter: Math.round(indoor * (1 - a.filterRemoval)),
    withMask: Math.round(outdoor * a.maskPass),
    who: a.whoPm25,
    commute: {
      alt,
      co2,
      kmAvoided: alt ? Math.round(p.km * 2 * WORKING_DAYS) : 0,
      households: a.households,
      society: Math.round(co2 * a.households * 10) / 10
    }
  };
}
