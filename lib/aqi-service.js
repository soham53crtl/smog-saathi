// Live air quality from Open-Meteo (no API key needed).
import {pm25ToAqi} from "../src/logic.js";
import {AQI_CACHE_MS} from "./config.js";
import {HttpError} from "./errors.js";
import {getJson} from "./http.js";

const aqiCache = new Map();
const inflight = new Map();
/** Geocode a city and estimate its Indian AQI from live PM2.5. Cached for 10 minutes; concurrent lookups share one upstream call. */
export async function lookupAqi(/** @type {string} */ city, now = Date.now()) {
  const key = city.toLowerCase();
  const hit = aqiCache.get(key);
  if (hit && now - hit.at < AQI_CACHE_MS) {
    return hit.value;
  }
  let pending = inflight.get(key);
  if (!pending) {
    pending = fetchAqi(city).finally(() => inflight.delete(key));
    inflight.set(key, pending);
  }
  const value = await pending;
  if (aqiCache.size > 200) {
    aqiCache.clear();
  }
  aqiCache.set(key, {at: now, value});
  return value;
}
async function fetchAqi(/** @type {string} */ city) {
  const geo = await getJson(
    `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(city)}&count=1&language=en&format=json`
  );
  const place = geo.results?.[0];
  if (!place) {
    throw new HttpError(404, "City not found. Check the spelling or enter the AQI manually.");
  }
  const air = await getJson(
    `https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${Number(place.latitude)}&longitude=${Number(place.longitude)}&current=pm2_5`
  );
  const pm = Number(air.current?.pm2_5);
  if (!Number.isFinite(pm)) {
    throw new HttpError(502, "No live PM2.5 reading for this place. Enter the AQI manually.");
  }
  return {
    place: [place.name, place.admin1].filter(Boolean).join(", "),
    pm25: Math.round(pm),
    aqi: pm25ToAqi(pm)
  };
}
