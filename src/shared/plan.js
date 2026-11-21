// The rule-based plan engine: profile in, ordered actions with Why and Impact out.
import {BANDS, SEVERITY_AVOID_OUTDOORS, SEVERITY_LIMIT_OUTDOORS, VERY_POOR_INDEX} from "./constants.js";
import {aqiBand} from "./aqi.js";
import {monthlyCO2Saving} from "./impact.js";
import {localNote} from "./locations.js";
/** @typedef {import("./types.js").Profile} Profile */
/** @typedef {import("./types.js").Action} Action */

/** @type {(group: string, title: string, why: string, impact: string) => Action} */
const action = (group, title, why, impact) => ({group, title, why, impact});

/** @returns {Action[]} */
function outdoorActions(/** @type {number} */ severity) {
  const g = "Today outdoors";
  if (severity >= SEVERITY_AVOID_OUTDOORS) return [action(g, "Keep outdoor time to essentials and wear a well-fitted N95/FFP2 mask", "At these levels fine particles (PM2.5) reach deep into the lungs and bloodstream. Cloth and surgical masks let most of them through.", "A sealed N95 can filter roughly 95% of fine particles; a loose cloth mask far less.")];
  if (severity >= SEVERITY_LIMIT_OUTDOORS) return [action(g, "Shift walks and play to the afternoon, or move them indoors", "In winter, cold air traps pollution near the ground, so levels usually peak in the early morning and late evening.", "Avoiding peak hours can noticeably cut the dose your lungs receive.")];
  return [action(g, "Normal routines are fine; skip busy roads and idling traffic", "Pollution is highest right beside heavy traffic.", "A street or two away from the main road can mean visibly cleaner air.")];
}

/** @returns {Action[]} */
function homeActions(/** @type {Profile} */ p) {
  const g = "Inside your home";
  const filter = p.purifier
    ? action(g, "Run the purifier in the bedroom or main room with doors closed, and check the filter", "A purifier only cleans the air in the room it is in, and a clogged filter does little.", "A correctly sized HEPA unit typically removes well over half of indoor PM2.5.")
    : action(g, "Build a low-cost box-fan filter: strap a MERV-13 (or better) filter to a box fan", "This is the community “Corsi-Rosenthal” design; it moves a lot of air through a good filter for a fraction of a purifier’s price.", "Studies of such DIY filters show substantial PM2.5 reduction in a single room.");
  const airing = BANDS.indexOf(aqiBand(p.aqi)) >= VERY_POOR_INDEX
    ? action(g, "Keep windows and doors shut today and rely on filtered air", "Outdoor air is far dirtier than the air you have already cleaned indoors, so opening up lets it back in.", "Keeps indoor PM2.5 as low as your filtering and source control allow.")
    : action(g, "Air the house once a day for 10–15 minutes in the cleanest part of the afternoon, then keep windows shut", "Mixing improves when the sun warms the air, so outdoor levels often dip a little then.", "Stops trapped cooking fumes and CO2 building up without inviting peak-hour smog.");
  return [
    airing,
    filter,
    action(g, "Damp-mop and wipe surfaces instead of sweeping; skip incense, mosquito coils and candles", "Dry sweeping lifts settled dust, and smoke from incense and coils adds fine particles indoors.", "Removes indoor sources you fully control.")
  ];
}

/** @returns {Action[]} */
function kitchenAndHeatingActions(/** @type {Profile} */ p) {
  const g = "Cooking and heating";
  const out = [p.cooking === "biomass"
    ? action(g, "Move toward LPG or induction; until then cook with a chimney or an exhaust fan and a door open", "Burning wood, coal or dung cakes releases large amounts of PM2.5 right where the family breathes.", "Often the single biggest indoor change, because indoor levels from such stoves can be many times the outdoor reading.")
    : action(g, "Switch the kitchen exhaust on while cooking and for 10 minutes after", "Frying and high-heat cooking create fine particles even with clean fuels.", "Lowers the spike that cooking adds to indoor air.")];
  if (p.heating === "burn") out.push(action(g, "Replace burning with layers, hot-water bottles or a thermostat-fitted heater; never burn waste", "Open fires produce PM2.5 and carbon monoxide indoors and add to the neighbourhood’s smog.", "Cuts both your indoor exposure and your share of the community’s emissions."));
  else if (p.heating === "electric") out.push(action(g, "Heat one room, not the house, and use blankets overnight", "Less electricity means less power-plant demand and a lower bill.", "Roughly halves heating energy for a family that uses one room."));
  return out;
}

/** @returns {Action[]} */
function commuteActions(/** @type {Profile} */ p) {
  const g = "Getting around";
  switch (p.commute) {
    case "wfh": return [action(g, "Work from home on severe days and bundle errands into one trip", "Every avoided trip is one less engine adding to the same trapped air.", "Zero commute emissions on those days.")];
    case "active": return [action(g, "Great choice. On Poor-or-worse days, walk or cycle away from main roads", "Exertion raises how much air you inhale, so route matters more than usual.", "Keeps the benefit of activity while limiting the dose.")];
    case "metro":
    case "bus": return [action(g, "Keep using public transport; a well-fitted mask helps at crowded platforms", "One bus or metro coach replaces dozens of private vehicles.", `You already avoid about ${monthlyCO2Saving("car", p.commute, p.km)} kg CO2 a month compared with driving.`)];
    default: {
      const alt = p.commute === "car" ? "metro" : "bus";
      return [action(g, p.commute === "car" ? "Try metro or bus on 3 days a week, and carpool the rest" : "Use bus or metro on smog-heavy days", "Private vehicles are a major urban source of PM2.5 and nitrogen oxides, and cold, still air keeps those emissions close to us.", `Switching fully would avoid about ${monthlyCO2Saving(p.commute, alt, p.km)} kg CO2 a month; sharing a car with 3 others cuts your share of its emissions by 75%.`)];
    }
  }
}

/** @returns {Action[]} */
function communityActions(/** @type {boolean} */ sensitive) {
  const g = "Your community";
  const out = [
    action(g, "Report garbage or leaf burning, avoid firecrackers, and switch off engines at long stops", "Open burning and idling are local sources that neighbours can remove quickly.", "Small, shared actions lower the baseline everyone breathes."),
    action(g, "Ask your society or RWA to name an air-quality champion and post the daily AQI on the notice board or group chat", "People change habits faster when the whole building sees the same number.", "Turns individual tips into a shared routine for every household."),
    action(g, "Start a carpool or school-run group and agree on no idling at the gate", "Shared rides and switched-off engines cut vehicle emissions right where children gather.", "Each shared car removes several separate trips."),
    action(g, "Ask for water sprinkling and covered material at nearby construction, and for roads to be vacuum-swept", "Road and construction dust is a large source of coarse and fine particles.", "Tackles a source that no single household can fix."),
    action(g, "Open the community hall as a clean-air room on Severe days, with a shared purifier or box-fan filters", "Not every home can afford a purifier, and a shared room protects those who cannot.", "Gives children, elders and neighbours a safer place for a few hours."),
    action(g, "Check on elderly neighbours and organise a bulk order of N95 masks", "Older adults are often alone and the first to feel the effects.", "A phone call and a mask can prevent an emergency.")
  ];
  if (sensitive) out.push(action(g, "Watch for coughing, wheeze, chest tightness or breathlessness and contact a doctor if they appear", "Children, older adults and people with lung or heart conditions react sooner.", "Early advice prevents an emergency."));
  return out;
}

/** @returns {Action[]} */
function localActions(/** @type {string} */ city) {
  const note = localNote(city);
  return note ? [action(`Local to ${city}`, note.title, note.why, "City rules and transport options differ, so local advice beats generic advice.")] : [];
}

/**
 * Build the rule-based plan. Households with children, elders or respiratory
 * conditions are treated one severity level stricter.
 * @param {Profile} p
 */
export function buildPlan(p) {
  const band = aqiBand(p.aqi);
  const idx = BANDS.indexOf(band);
  const sensitive = p.kids || p.elderly || p.resp;
  const actions = [
    ...outdoorActions(idx + (sensitive ? 1 : 0)),
    ...homeActions(p),
    ...kitchenAndHeatingActions(p),
    ...commuteActions(p),
    ...localActions(p.city),
    ...communityActions(sensitive)
  ];
  return {band, idx, sensitive, actions};
}
