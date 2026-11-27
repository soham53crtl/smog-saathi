// "Write my one-day plan": asks /api/plan and shows the reply.
import {$, postJson, readForm, setBusy} from "./dom.js";

/** @type {AbortController | null} */
let ctrl = null;
export async function runAI() {
  const box = $("aiout"),
    btn = $("ai"),
    stop = $("stop");
  ctrl = new AbortController();
  btn.disabled = true;
  stop.hidden = false;
  setBusy(box, true);
  box.textContent = "Thinking…";
  try {
    const r = await postJson("/api/plan", readForm(), ctrl.signal);
    box.textContent =
      r.ok && r.text ? r.text : r.error || "Couldn’t get an AI plan. Use the plan above.";
  } catch (e) {
    box.textContent =
      /** @type {{name?: string}} */ (e).name === "AbortError"
        ? ""
        : "Couldn’t reach the server. Use the plan above.";
  } finally {
    btn.disabled = false;
    stop.hidden = true;
    setBusy(box, false);
    ctrl = null;
  }
}
export function stopAI() {
  ctrl?.abort();
}
