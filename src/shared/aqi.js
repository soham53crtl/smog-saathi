// Indian AQI bands and PM2.5 <-> AQI conversion.
import {BANDS} from "./constants.js";
import {clamp} from "./numbers.js";

export function aqiBand(aqi) {
  return BANDS.find(b => aqi <= b.max);
}

/* ---------- PM2.5 <-> Indian AQI (CPCB breakpoints) ---------- */
// [pmLow, pmHigh, aqiLow, aqiHigh], PM2.5 in µg/m³. Live readings are not 24-hour averages, so results are estimates.
const PM25_BREAKPOINTS = [[0, 30, 0, 50], [30, 60, 50, 100], [60, 90, 100, 200], [90, 120, 200, 300], [120, 250, 300, 400], [250, 380, 400, 500]];
const lerp = (x, x0, x1, y0, y1) => y0 + ((x - x0) * (y1 - y0)) / (x1 - x0);

/** Estimate Indian AQI from a PM2.5 reading (µg/m³). */
export function pm25ToAqi(pm) {
  const v = Math.max(0, pm);
  const seg = PM25_BREAKPOINTS.find(([, hi]) => v <= hi);
  return seg ? Math.round(lerp(v, seg[0], seg[1], seg[2], seg[3])) : 500;
}
/** Inverse of {@link pm25ToAqi}; AQI above 500 is treated as 500. */
export function aqiToPm25(aqi) {
  const v = clamp(aqi, 0, 500);
  const seg = PM25_BREAKPOINTS.find(([, , , hi]) => v <= hi) ?? PM25_BREAKPOINTS[PM25_BREAKPOINTS.length - 1];
  return Math.round(lerp(v, seg[2], seg[3], seg[0], seg[1]));
}
