import test from "node:test";
import assert from "node:assert/strict";

process.env.LLM_PROVIDER = "groq";
process.env.GROQ_API_KEY = "test-key";
const realFetch = globalThis.fetch;
globalThis.fetch = async url => {
  const u = String(url);
  if (u.includes("geocoding-api")) return Response.json({results: [{name: "Delhi", latitude: 28.6, longitude: 77.2}]});
  if (u.includes("air-quality-api")) return Response.json({current: {pm2_5: 60}});
  return Response.json({choices: [{message: {content: "Stay indoors."}}]});
};
const {default: chat} = await import("../api/chat.js");
const {default: aqi} = await import("../api/aqi.js");
test.after(() => { globalThis.fetch = realFetch; });

// Minimal stand-ins for Vercel's req/res.
const call = (fn, req) => new Promise(resolve => {
  const res = {writeHead(s, h) { this.status = s; this.headers = h; }, end(b) { resolve({status: this.status, headers: this.headers, body: b ? JSON.parse(b) : null}); }};
  req.headers ??= {};
  req.socket ??= {remoteAddress: "7.7.7.7"};
  fn(req, res); // passed as-is so getters (like Vercel's req.body) stay intact
});
const msgs = [{role: "user", content: "hi"}];

test("Vercel functions are the shared handler", () => {
  assert.equal(typeof chat, "function");
  assert.equal(chat, aqi);
});
test("a pre-parsed JSON body (Vercel style) is accepted", async () => {
  const r = await call(chat, {method: "POST", url: "/api/chat", body: {profile: {city: "Delhi"}, messages: msgs}});
  assert.equal(r.status, 200);
  assert.deepEqual(r.body, {text: "Stay indoors."});
});
test("a string body is parsed; invalid or oversized bodies are rejected", async () => {
  assert.equal((await call(chat, {method: "POST", url: "/api/chat", body: JSON.stringify({messages: msgs})})).status, 200);
  assert.equal((await call(chat, {method: "POST", url: "/api/chat", body: "{nope"})).status, 400);
  assert.equal((await call(chat, {method: "POST", url: "/api/chat", body: "x".repeat(20_000)})).status, 413);
  const broken = {method: "POST", url: "/api/chat"};
  Object.defineProperty(broken, "body", {get() { throw new Error("Vercel could not parse the body"); }});
  assert.equal((await call(chat, broken)).status, 400);
});
test("GET /api/aqi works through the Vercel entry", async () => {
  const r = await call(aqi, {method: "GET", url: "/api/aqi?city=Delhi"});
  assert.equal(r.status, 200);
  assert.equal(r.body.aqi, 100);
});
