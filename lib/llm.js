// Talks to the configured LLM provider: Gemini, or OpenAI-compatible APIs (xAI Grok, Groq).
import {cleanMessage} from "../src/logic.js";
import {
  MAX_REPLY,
  MAX_TOKENS,
  TEMPERATURE,
  UNAVAILABLE,
  UPSTREAM_TIMEOUT_MS,
  llmSettings,
  showProviderDetail
} from "./config.js";
import {HttpError} from "./errors.js";
import {spendAi} from "./rate-limit.js";

/** @typedef {{role: "user"|"assistant", content: string}} Turn */
/** @typedef {ReturnType<typeof llmSettings>} Settings */
/** @typedef {{url: string, headers: Record<string, string>, body: unknown}} ProviderRequest */

/** @param {Settings} s @param {string|undefined} system @param {Turn[]} messages */
function geminiRequest(s, system, messages) {
  /** @type {Record<string, unknown>} */
  const body = {
    contents: messages.map(m => ({
      role: m.role === "assistant" ? "model" : "user",
      parts: [{text: m.content}]
    })),
    generationConfig: {maxOutputTokens: MAX_TOKENS, temperature: TEMPERATURE}
  };
  if (system) {
    body.systemInstruction = {parts: [{text: system}]};
  }
  return {
    url: `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(s.model)}:generateContent`,
    headers: {"x-goog-api-key": s.key ?? ""},
    body
  };
}

/** OpenAI-compatible chat completions (xAI Grok, Groq). @param {Settings} s @param {string|undefined} system @param {Turn[]} messages */
function openAiRequest(s, system, messages) {
  const reasoning =
    s.name === "groq" && s.model.startsWith("openai/gpt-oss") ? {reasoning_effort: "low"} : {};
  return {
    url: s.url ?? "",
    headers: {Authorization: `Bearer ${s.key}`},
    body: {
      model: s.model,
      max_tokens: MAX_TOKENS,
      temperature: TEMPERATURE,
      ...reasoning,
      messages: [...(system ? [{role: "system", content: system}] : []), ...messages]
    }
  };
}

/** Pull the reply text out of a provider response and note whether it hit the token limit. */
function readReply(/** @type {string} */ provider, /** @type {any} */ data) {
  if (provider === "gemini") {
    const c = data.candidates?.[0];
    return {
      text: String(
        (c?.content?.parts ?? []).map((/** @type {{text?: string}} */ x) => x.text || "").join("")
      ),
      cutOff: c?.finishReason === "MAX_TOKENS"
    };
  }
  const c = data.choices?.[0];
  return {text: String(c?.message?.content ?? ""), cutOff: c?.finish_reason === "length"};
}

/** Extract the human-readable message from a provider error body. */
function providerDetail(/** @type {string} */ raw) {
  try {
    const j = JSON.parse(raw);
    return cleanMessage(j.error?.message ?? j.error ?? j.message ?? raw);
  } catch {
    return cleanMessage(raw);
  }
}

/** Client-safe explanation for a provider error. In production the provider's own text stays in the server log. */
function upstreamMessage(/** @type {number} */ status, /** @type {string} */ raw) {
  let msg = UNAVAILABLE;
  if (status === 401 || status === 403) {
    msg =
      "The AI provider rejected the API key or account. Check the key and that the account has credits.";
  } else if (status === 404) {
    msg = "The AI model was not found. Set LLM_MODEL to a model your account can use.";
  } else if (status === 429) {
    msg = "The AI provider is rate-limiting or out of credits. Try again shortly.";
  }
  return showProviderDetail() && raw ? `${msg} (Provider ${status}: ${providerDetail(raw)})` : msg;
}

async function callProvider(/** @type {Settings} */ s, /** @type {ProviderRequest} */ req) {
  let response;
  try {
    response = await fetch(req.url, {
      method: "POST",
      signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
      headers: {"Content-Type": "application/json", ...req.headers},
      body: JSON.stringify(req.body)
    });
  } catch (e) {
    console.error(`[${s.name}] request failed: ${e instanceof Error ? e.message : e}`);
    throw new HttpError(502, UNAVAILABLE);
  }
  if (!response.ok) {
    const raw = (await response.text().catch(() => "")).slice(0, 500);
    console.error(`[${s.name}] model ${s.model} returned ${response.status}: ${raw}`);
    throw new HttpError(502, upstreamMessage(response.status, raw));
  }
  return response;
}

/** Ask the model. Throws HttpError (503 no key, 429 daily budget, 502 provider trouble). @param {{system?: string, messages: Turn[]}} args */
export async function llm({system, messages}) {
  const s = llmSettings();
  if (!s.key) {
    throw new HttpError(
      503,
      `AI is not configured on this server (set ${s.keyEnv}). The rule-based plan above still works.`
    );
  }
  if (!spendAi()) {
    throw new HttpError(
      429,
      "Today’s AI limit has been reached. The rule-based plan above still works."
    );
  }
  const request =
    s.name === "gemini" ? geminiRequest(s, system, messages) : openAiRequest(s, system, messages);
  const {text, cutOff} = readReply(s.name, await (await callProvider(s, request)).json());
  if (cutOff) {
    console.error(`[${s.name}] reply hit the token limit (${MAX_TOKENS})`);
  }
  if (!text) {
    return "No answer was generated.";
  }
  return (
    text.slice(0, MAX_REPLY) +
    (cutOff ? "\n\n[The reply was cut short. Press the button again for a full answer.]" : "")
  );
}
