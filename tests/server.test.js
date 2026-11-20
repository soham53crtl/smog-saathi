import test, {before, after} from "node:test";
import assert from "node:assert/strict";

process.env.LLM_PROVIDER = "gemini";
process.env.GEMINI_API_KEY = "test-key";
const {server, lookupAqi, spendAi} = await import("../server.js");

// Local requests pass through; upstream services (Open-Meteo, Gemini) are faked and recorded.
const realFetch = globalThis.fetch;
const upstream = [];
globalThis.fetch = async (url, opts) => {
  const u = String(url);
  if (u.startsWith("http://127.0.0.1")) return realFetch(url, opts);
  upstream.push({url: u, opts});
  if (u.includes("geocoding-api")) return Response.json(u.includes("Nowhere") ? {} : {results: [{name: "Kolkata", admin1: "West Bengal", latitude: 22.57, longitude: 88.36}]});
  if (u.includes("air-quality-api")) return Response.json({current: {pm2_5: 75}});
  if (u.includes("generativelanguage")) return Response.json({candidates: [{content: {parts: [{text: "Stay indoors."}]}}]});
  throw new Error("unexpected upstream call: " + u);
};

let base;
before(async () => { await new Promise(r => server.listen(0, r)); base = `http://127.0.0.1:${server.address().port}`; });
after(() => { server.close(); globalThis.fetch = realFetch; });
const post = (path, body) => fetch(base + path, {method: "POST", body: typeof body === "string" ? body : JSON.stringify(body)});
const profile = {city: "Kolkata", aqi: 320, kids: true, commute: "car", km: 10, cooking: "lpg", heating: "layers", lang: "English"};

test("serves the app with security headers", async () => {
  const r = await fetch(base + "/");
  assert.equal(r.status, 200);
  assert.match(r.headers.get("content-security-policy"), /default-src 'self'/);
  assert.equal(r.headers.get("x-content-type-options"), "nosniff");
});
test("only whitelisted files are served", async () => {
  for (const p of ["/server.js", "/package.json", "/.env", "/tests/logic.test.js"]) assert.equal((await fetch(base + p)).status, 404, p);
});
test("rejects malformed JSON and oversized bodies", async () => {
  assert.equal((await post("/api/plan", "{nope")).status, 400);
  assert.equal((await post("/api/plan", "x".repeat(10_000))).status, 413);
});
test("unknown routes and wrong methods return 404", async () => {
  assert.equal((await fetch(base + "/nope")).status, 404);
  assert.equal((await fetch(base + "/api/plan")).status, 404);
});
test("live AQI geocodes, converts PM2.5 and caches", async () => {
  const before = upstream.length;
  const r = await fetch(base + "/api/aqi?city=Kolkata");
  assert.deepEqual(await r.json(), {place: "Kolkata, West Bengal", pm25: 75, aqi: 150});
  await fetch(base + "/api/aqi?city=Kolkata");
  assert.equal(upstream.length - before, 2, "second call should be served from cache");
});
test("live AQI handles missing and unknown cities", async () => {
  assert.equal((await fetch(base + "/api/aqi")).status, 400);
  assert.equal((await fetch(base + "/api/aqi?city=Nowhere")).status, 404);
});
test("plan forwards a sanitised profile prompt to Gemini", async () => {
  const r = await post("/api/plan", {...profile, city: "<script>Delhi"});
  assert.deepEqual(await r.json(), {text: "Stay indoors."});
  const sent = upstream.at(-1);
  assert.equal(sent.opts.headers["x-goog-api-key"], "test-key");
  assert.match(sent.opts.body, /scriptDelhi/);
  assert.doesNotMatch(sent.opts.body, /<script>/);
});
test("chat sanitises history and sends the profile as a system instruction", async () => {
  const r = await post("/api/chat", {profile, messages: [{role: "assistant", content: "hi"}, {role: "user", content: "Is it safe <b>to jog</b>?"}]});
  assert.equal(r.status, 200);
  const body = JSON.parse(upstream.at(-1).opts.body);
  assert.equal(body.contents.length, 1);
  assert.equal(body.contents[0].role, "user");
  assert.doesNotMatch(body.contents[0].parts[0].text, /</);
  assert.match(body.systemInstruction.parts[0].text, /Kolkata/);
});
test("chat requires a user question", async () => {
  assert.equal((await post("/api/chat", {profile, messages: []})).status, 400);
  assert.equal((await post("/api/chat", "null")).status, 400);
});

test("static files are gzipped, ETagged and revalidated with 304", async () => {
  const first = await fetch(base + "/src/logic.js");
  assert.equal(first.headers.get("content-encoding"), "gzip");
  const etag = first.headers.get("etag");
  assert.ok(etag);
  const again = await fetch(base + "/src/logic.js", {headers: {"If-None-Match": etag}});
  assert.equal(again.status, 304);
});
test("API responses are never cached and pages restrict browser features", async () => {
  const api = await fetch(base + "/api/aqi");
  assert.equal(api.headers.get("cache-control"), "no-store");
  assert.match((await fetch(base + "/")).headers.get("permissions-policy"), /geolocation=\(\)/);
});
test("concurrent lookups for one city share a single upstream call", async () => {
  const before = upstream.filter(u => u.url.includes("geocoding-api")).length;
  const [a, b] = await Promise.all([lookupAqi("Pune"), lookupAqi("Pune")]);
  assert.deepEqual(a, b);
  assert.equal(upstream.filter(u => u.url.includes("geocoding-api")).length - before, 1);
});
test("daily AI budget blocks at the limit and resets the next day", () => {
  const day = Date.UTC(2026, 0, 1);
  assert.equal(spendAi(day, 2), true);
  assert.equal(spendAi(day, 2), true);
  assert.equal(spendAi(day, 2), false);
  assert.equal(spendAi(day + 86_400_000, 2), true);
});

test("chat prepends the fixed emergency notice before the model reply", async () => {
  const r = await post("/api/chat", {profile, messages: [{role: "user", content: "child is breathless"}]});
  const text = (await r.json()).text;
  assert.match(text, /^This may be an emergency\. Call 112/);
  assert.match(text, /Stay indoors\.$/);
});
