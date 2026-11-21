// Follow-up chat. History lives in memory only.
import {$, el, postJson, readForm, setBusy} from "./dom.js";

const history = [];
function addMessage(role, text) {
  const p = el("p", "msg " + role);
  p.append(el("strong", null, role === "user" ? "You: " : "Saathi: "), document.createTextNode(text));
  $("chatlog").append(p);
  p.scrollIntoView({block: "nearest"});
}
export async function sendChat(e) {
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
