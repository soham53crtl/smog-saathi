// Public API of the shared (browser + server) logic. Import from here, not from src/shared/*.
export {BANDS, EF, LANGS, COMMUTES} from "./shared/constants.js";
export {clamp, toNum} from "./shared/numbers.js";
export {cleanText, cleanMessage, sanitizeMessages, normalise} from "./shared/sanitize.js";
export {aqiBand, pm25ToAqi, aqiToPm25} from "./shared/aqi.js";
export {ASSUMPTIONS, monthlyCO2Saving, estimateImpact} from "./shared/impact.js";
export {buildPlan} from "./shared/plan.js";
export {localNote} from "./shared/locations.js";
export {promptFor, chatSystemPrompt} from "./shared/prompts.js";
export {emergencyNotice} from "./shared/safety.js";
