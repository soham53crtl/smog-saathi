// Named limits and lookup tables shared by every module.

export const BANDS = [
  {max: 50, name: "Good"},
  {max: 100, name: "Satisfactory"},
  {max: 200, name: "Moderate"},
  {max: 300, name: "Poor"},
  {max: 400, name: "Very Poor"},
  {max: Infinity, name: "Severe"}
];
/** Approximate kg CO2 per passenger-km, by commute mode. @type {Record<string, number>} */
export const EF = {car: 0.17, bike: 0.04, bus: 0.03, metro: 0.03, active: 0, wfh: 0};
export const LANGS = ["English", "Hinglish", "Hindi", "Bengali"];
export const COMMUTES = Object.keys(EF);
export const COOKING = ["lpg", "png", "induction", "biomass"];
export const HEATING = ["layers", "electric", "burn"];
export const WORKING_DAYS = 22;
export const MAX_TEXT = 60;
export const MAX_AQI = 999;
export const MAX_KM = 200;
export const DEFAULT_AQI = 150;
export const SEVERITY_AVOID_OUTDOORS = 5;
export const SEVERITY_LIMIT_OUTDOORS = 3;
export const VERY_POOR_INDEX = 4;
export const MAX_CHAT_TURNS = 6;
export const MAX_MESSAGE = 500;
