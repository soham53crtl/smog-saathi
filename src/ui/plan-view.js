// Renders the plan, the AQI header and the impact panel.
import {ASSUMPTIONS, buildPlan, estimateImpact} from "../logic.js";
import {$, el, readForm} from "./dom.js";

/** @typedef {import("../shared/types.js").Profile} Profile */

function renderImpact(/** @type {Profile} */ p) {
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
export function render() {
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
/** @type {ReturnType<typeof setTimeout> | undefined} */
let timer;
export const scheduleRender = () => { clearTimeout(timer); timer = setTimeout(render, 250); };
