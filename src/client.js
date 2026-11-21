// Entry point of the browser app: wires the page to the UI modules.
import {$} from "./ui/dom.js";
import {render, scheduleRender} from "./ui/plan-view.js";
import {useLiveAqi} from "./ui/live-aqi.js";
import {runAI, stopAI} from "./ui/ai-plan.js";
import {sendChat} from "./ui/chat.js";

$("f").addEventListener("submit", e => { e.preventDefault(); render(); $("rt").focus(); });
$("f").addEventListener("input", scheduleRender);
$("live").addEventListener("click", useLiveAqi);
$("ai").addEventListener("click", runAI);
$("stop").addEventListener("click", stopAI);
$("chat").addEventListener("submit", sendChat);
render();
