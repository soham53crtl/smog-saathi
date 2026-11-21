// City-specific context for the plan.

/** @typedef {{title: string, why: string}} LocalNote */
/** @type {[RegExp, LocalNote][]} */
const LOCAL_NOTES = [
  [/delhi|noida|gurugram|gurgaon|ghaziabad|faridabad/i, {title: "Follow the current GRAP stage and prefer Delhi Metro or buses", why: "Delhi-NCR’s air quality commission (CAQM) announces GRAP stages that restrict construction, vehicles and burning when air turns Poor or worse."}],
  [/kolkata|howrah|salt lake/i, {title: "Use Metro, trams or suburban trains wherever you can", why: "They are the lowest-emission ways to get around the city, and winter smog here tends to build up in still late-evening and early-morning hours."}],
  [/mumbai|thane|navi mumbai/i, {title: "Lean on suburban trains and the metro, and report uncovered construction sites", why: "They remove the most road traffic, and construction dust is a big local source."}],
  [/lucknow|kanpur|patna/i, {title: "Avoid waste and crop-residue burning and ask your ward office to act on open burning", why: "Cold, still winter air across the Indo-Gangetic plain traps smoke close to the ground."}]
];
/** @returns {LocalNote|null} */
export function localNote(city) {
  const hit = LOCAL_NOTES.find(([re]) => re.test(city));
  return hit ? hit[1] : null;
}
