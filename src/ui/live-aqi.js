// "Use live AQI for this city": fills the AQI field from /api/aqi.
import {$} from "./dom.js";
import {render} from "./plan-view.js";

export async function useLiveAqi() {
  const status = $("aqistatus"), btn = $("live");
  btn.disabled = true; status.textContent = "Looking up live air quality…";
  try {
    const r = await fetch("/api/aqi?city=" + encodeURIComponent($("city").value));
    const d = await r.json().catch(() => ({}));
    if (!r.ok) { status.textContent = d.error || "Couldn’t fetch live data. Enter the AQI manually."; return; }
    $("aqi").value = d.aqi; render();
    status.textContent = `Live PM2.5 in ${d.place}: ${d.pm25} µg/m³, about AQI ${d.aqi} on the Indian scale (estimated from PM2.5). Data: Open-Meteo.`;
  } catch { status.textContent = "Couldn’t reach the server. Enter the AQI manually."; }
  finally { btn.disabled = false; }
}
