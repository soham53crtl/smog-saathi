import {ASSUMPTIONS, buildPlan, estimateImpact, normalise} from "./logic.js";

/* ---------- DOM helpers (textContent only; no innerHTML) ---------- */
/** Look up an element that is known to exist in index.html. @returns {any} */
const $ = id => document.getElementById(id);
function el(tag, cls, text) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text !== undefined && text !== null) e.textContent = text;
  return e;
}
function readForm() {
  return normalise({
    city: $("city").value, aqi: $("aqi").value, kids: $("kids").checked, elderly: $("elderly").checked, resp: $("resp").checked,
    commute: $("commute").value, km: $("km").value, cooking: $("cooking").value, heating: $("heating").value,
    purifier: $("purifier").checked, lang: $("lang").value
  });
}
async function postJson(url, payload, signal) {
  const r = await fetch(url, {method: "POST", headers: {"Content-Type": "application/json"}, body: JSON.stringify(payload), signal});
  const d = await r.json().catch(() => ({}));
  return {ok: r.ok, text: d.text, error: d.error};
}
function setBusy(node, busy) { node.setAttribute("aria-busy", String(busy)); }

/* ---------- Plan and impact ---------- */
function renderImpact(p) {
  const i = estimateImpact(p), a = ASSUMPTIONS, card = el("div", "card");
  const list = el("ul", "impact");
  list.append(
    el("li", null, `Outdoors without a mask: about ${i.outdoor} µg/m³ of PM2.5, ${(i.outdoor / i.who).toFixed(1)}× the WHO daily guideline of ${i.who}. With a well-fitted N95: about ${i.withMask}.`),
    el("li", null, `Indoors with windows mostly shut: about ${i.indoor} µg/m³. ${p.purifier ? "With your purifier running" : "With a purifier or box-fan filter"}: about ${i.withFilter}.`)
  );
  if (i.commute.alt) list.append(el("li", null, `Commute: switching to ${i.commute.alt} avoids about ${i.commute.kmAvoided} private-vehicle km and ${i.commute.co2} kg CO2 a month. If ${i.commute.households} households in your society did the same, that is ${i.commute.society} kg CO2 a month.`));
  card.append(el("h3", null, "What your choices change"), list,
    el("p", "note", `Estimates, not measurements. They assume about ${Math.round(a.infiltration * 100)}% of outdoor PM2.5 gets indoors with windows shut, a filter that removes ${Math.round(a.filterRemoval * 100)}%, and an N95 that lets ${Math.round(a.maskPass * 100)}% through.`));
  return card;
}
function render() {
  const p = readForm(), plan = buildPlan(p), frag = document.createDocumentFragment();
  const head = el("div", "card aqi"), meta = el("div");
  meta.append(el("span", "pill b" + plan.idx, plan.band.name),
    el("p", "sub", "AQI in " + p.city + (plan.sensitive ? ". Advice is one level stricter because of who is at home." : ".")));
  head.append(el("div", "num b" + plan.idx, String(p.aqi)), meta);
  frag.append(head, renderImpact(p));
  let last = "";
  for (const a of plan.actions) {
    if (a.group !== last) { frag.append(el("h3", "tag", a.group)); last = a.group; }
    const c = el("article", "card act");
    c.append(el("h3", null, a.title), el("p", "why", "Why: " + a.why), el("p", "imp", "Impact: " + a.impact));
    frag.append(c);
  }
  $("out").replaceChildren(frag);
}
let timer;
const debounced = () => { clearTimeout(timer); timer = setTimeout(render, 250); };

/* ---------- Live AQI ---------- */
async function useLiveAqi() {
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

/* ---------- AI plan ---------- */
let ctrl = null;
async function runAI() {
  const box = $("aiout"), btn = $("ai"), stop = $("stop");
  ctrl = new AbortController();
  btn.disabled = true; stop.hidden = false; setBusy(box, true); box.textContent = "Thinking…";
  try {
    const r = await postJson("/api/plan", readForm(), ctrl.signal);
    box.textContent = r.ok && r.text ? r.text : (r.error || "Couldn’t get an AI plan. Use the plan above.");
  } catch (e) {
    box.textContent = e.name === "AbortError" ? "" : "Couldn’t reach the server. Use the plan above.";
  } finally { btn.disabled = false; stop.hidden = true; setBusy(box, false); ctrl = null; }
}

/* ---------- Chat ---------- */
const history = [];
function addMessage(role, text) {
  const p = el("p", "msg " + role);
  p.append(el("strong", null, role === "user" ? "You: " : "Saathi: "), document.createTextNode(text));
  $("chatlog").append(p);
  p.scrollIntoView({block: "nearest"});
}
async function sendChat(e) {
  e.preventDefault();
  const input = $("q"), text = input.value.trim();
  if (!text) return;
  input.value = ""; addMessage("user", text); history.push({role: "user", content: text});
  $("send").disabled = true; setBusy($("chatlog"), true);
  try {
    const r = await postJson("/api/chat", {profile: readForm(), messages: history});
    if (r.ok && r.text) { history.push({role: "assistant", content: r.text}); addMessage("assistant", r.text); }
    else { history.pop(); addMessage("assistant", r.error || "Sorry, I couldn’t answer that just now."); }
  } catch { history.pop(); addMessage("assistant", "Couldn’t reach the server. Please try again."); }
  finally { $("send").disabled = false; setBusy($("chatlog"), false); input.focus(); }
}

/* ---------- Wire up ---------- */
$("f").addEventListener("submit", e => { e.preventDefault(); render(); $("rt").focus(); });
$("f").addEventListener("input", debounced);
$("live").addEventListener("click", useLiveAqi);
$("ai").addEventListener("click", runAI);
$("stop").addEventListener("click", () => ctrl && ctrl.abort());
$("chat").addEventListener("submit", sendChat);
render();
