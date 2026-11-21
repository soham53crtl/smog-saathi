import test, {after} from "node:test";
import assert from "node:assert/strict";

// Each provider is loaded as a fresh module instance (query string) with its own environment.
const realFetch = globalThis.fetch;
const upstream = [];
globalThis.fetch = async (url, opts) => {
  const u = String(url);
  if (u.startsWith("http://127.0.0.1")) return realFetch(url, opts);
  upstream.push({url: u, opts});
  const truncated = opts.headers.Authorization === "Bearer long-reply";
  if (truncated) return Response.json({choices: [{message: {content: "Partial plan"}, finish_reason: "length"}]});
  const fail = {"Bearer bad-key": [401, "{}"], "Bearer no-model": [404, "{}"], "Bearer old-model": [400, '{"error":{"message":"Model foo has been decommissioned"}}']}[opts.headers.Authorization];
  if (fail) return new Response(fail[1], {status: fail[0]});
  return Response.json({choices: [{message: {content: "Stay indoors."}}]});
};
after(() => { globalThis.fetch = realFetch; });

async function boot(tag, env) {
  for (const k of ["GEMINI_API_KEY", "XAI_API_KEY", "GROQ_API_KEY", "LLM_PROVIDER", "LLM_MODEL", "GEMINI_MODEL"]) delete process.env[k];
  Object.assign(process.env, env);
  const {server} = await import(`../backend.js?${tag}`);
  await new Promise(r => server.listen(0, r));
  return {server, base: `http://127.0.0.1:${server.address().port}`};
}
const post = (base, path, body) => realFetch(base + path, {method: "POST", body: JSON.stringify(body)});

const CASES = [
  {name: "xai", env: {XAI_API_KEY: "xai-test"}, host: "api.x.ai", model: "grok-4"},
  {name: "groq", env: {GROQ_API_KEY: "gsk_test"}, host: "api.groq.com", model: "openai/gpt-oss-120b", effort: "low"},
  {name: "xai-custom-model", env: {XAI_API_KEY: "xai-test", LLM_MODEL: "my-model"}, host: "api.x.ai", model: "my-model"}
];
for (const c of CASES) {
  test(`${c.name}: OpenAI-compatible chat and plan requests`, async () => {
    const {server, base} = await boot(c.name, c.env);
    try {
      const chat = await post(base, "/api/chat", {profile: {city: "Kolkata"}, messages: [{role: "user", content: "hi"}]});
      assert.equal(chat.status, 200);
      assert.deepEqual(await chat.json(), {text: "Stay indoors."});
      const sent = upstream.at(-1), body = JSON.parse(sent.opts.body);
      assert.ok(sent.url.includes(c.host));
      assert.equal(sent.opts.headers.Authorization, "Bearer " + Object.values(c.env)[0]);
      assert.equal(body.model, c.model);
      assert.equal(body.reasoning_effort, c.effort);
      assert.equal(body.messages[0].role, "system");
      assert.match(body.messages[0].content, /Kolkata/);
      assert.deepEqual(body.messages[1], {role: "user", content: "hi"});

      assert.equal((await post(base, "/api/plan", {city: "Delhi", aqi: 300})).status, 200);
      const plan = JSON.parse(upstream.at(-1).opts.body);
      assert.equal(plan.messages.length, 1);
      assert.equal(plan.messages[0].role, "user");
    } finally { server.close(); }
  });
}
test("a missing key gives a clear 503 naming the variable to set", async () => {
  const {server, base} = await boot("none", {});
  try {
    const r = await post(base, "/api/plan", {city: "Delhi"});
    assert.equal(r.status, 503);
    assert.match((await r.json()).error, /GEMINI_API_KEY/);
  } finally { server.close(); }
});
test("LLM_PROVIDER overrides key auto-detection", async () => {
  const {server, base} = await boot("forced", {GEMINI_API_KEY: "g", XAI_API_KEY: "x", LLM_PROVIDER: "xai"});
  try {
    await post(base, "/api/plan", {city: "Delhi"});
    assert.ok(upstream.at(-1).url.includes("api.x.ai"));
  } finally { server.close(); }
});

test("provider errors give a helpful message without leaking details", async () => {
  const log = console.error; console.error = () => {};
  try {
    for (const [key, pattern] of [["bad-key", /API key/], ["no-model", /LLM_MODEL/], ["old-model", /decommissioned/]]) {
      const {server, base} = await boot("err-" + key, {XAI_API_KEY: key});
      try {
        const r = await post(base, "/api/plan", {city: "Delhi"});
        assert.equal(r.status, 502);
        assert.match((await r.json()).error, pattern);
      } finally { server.close(); }
    }
  } finally { console.error = log; }
});

test("a reply cut off by the token limit is flagged to the user", async () => {
  const log = console.error; console.error = () => {};
  const {server, base} = await boot("long", {GROQ_API_KEY: "long-reply"});
  try {
    const r = await post(base, "/api/plan", {city: "Delhi"});
    assert.match((await r.json()).text, /Partial plan[\s\S]*cut short/);
  } finally { console.error = log; server.close(); }
});

test("emergency guidance is returned even when the AI provider fails", async () => {
  const log = console.error; console.error = () => {};
  const {server, base} = await boot("emerg", {XAI_API_KEY: "bad-key"});
  try {
    const sick = await post(base, "/api/chat", {profile: {}, messages: [{role: "user", content: "child is breathless"}]});
    assert.equal(sick.status, 200);
    assert.match((await sick.json()).text, /112/);
    const normal = await post(base, "/api/chat", {profile: {}, messages: [{role: "user", content: "which mask is best?"}]});
    assert.equal(normal.status, 502);
  } finally { console.error = log; server.close(); }
});
