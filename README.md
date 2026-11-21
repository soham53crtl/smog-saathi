# Smog Saathi 🌫️

A GenAI assistant that helps families and communities navigate severe winter smog. It turns today's AQI and a household's lifestyle into low-emission routines, indoor air-quality hacks and cleaner alternatives, and explains the **why** and the **direct impact** of every suggestion.

## Features
- **Live AQI for your city:** one click geocodes the city and estimates the Indian AQI from live PM2.5 (Open-Meteo, no key needed, cached 10 minutes)
- **Tailored plan:** location notes (Delhi-NCR, Kolkata, Mumbai, Indo-Gangetic plain), household (children, elderly, respiratory conditions), commute, cooking fuel, heating and purifier
- **Why + Impact on every tip**, plus a "What your choices change" panel: outdoor vs indoor PM2.5 against the WHO guideline, with and without a mask or filter; vehicle-km and CO2 avoided, scaled to a housing society
- **Community actions:** RWA air-quality champion, carpool and no-idling, construction dust, a shared clean-air room, checking on elderly neighbours
- **AI one-day plan** and **follow-up chat** (xAI Grok, Groq or Gemini, server-side) in English, Hinglish, Hindi or Bengali
- Everything except the AI works with no key and no AI

## Run locally
```bash
# set ONE key: XAI_API_KEY (Grok), GROQ_API_KEY (Groq) or GEMINI_API_KEY (optional; live AQI and the rule-based plan work without it)
export XAI_API_KEY=xai-...   # PowerShell: $env:XAI_API_KEY="xai-..."
npm install                 # dev tools only; the app has zero runtime dependencies
npm start                   # http://localhost:3000
npm run check               # lint + type-check + tests (Node 20+)
```

## Architecture
```
index.html            semantic, accessible markup
src/styles.css        design tokens, light/dark, reduced motion
src/logic.js          pure logic: AQI bands, PM2.5<->AQI, plan engine, impact model, sanitisers, prompts
src/client.js            DOM rendering (textContent only), live AQI, AI plan, chat
backend.js             static server + /api/aqi, /api/plan, /api/chat (Gemini, xAI Grok or Groq)
tests/                node:test unit and HTTP tests (upstream services faked)
```

## How it maps to the judging parameters
| Parameter | What was done |
|---|---|
| Problem alignment | Location-aware live AQI and city notes; routines, indoor hacks and sustainable alternatives for each household; community actions; every tip explains Why and Impact, quantified in an assumptions-labelled impact panel; GenAI plan and chat |
| Code quality | Small single-purpose functions, named constants, JSDoc types checked by `tsc` (`checkJs`), ESLint, EditorConfig, shared pure logic for browser and server, zero runtime dependencies |
| Security | API key only on the server; CSP, `nosniff`, no `innerHTML`; whitelisted inputs and file serving; sanitised chat history (6 turns, 500 chars, control chars and angle brackets stripped); per-route body limits and per-IP rate limits (10/min for AI, 30/min for AQI); daily AI budget (`AI_DAILY_LIMIT`, default 500) to protect the API key; upstream timeouts; `no-store` API responses, Permissions-Policy, COOP; prompts treat user data as data |
| Efficiency | Static files read and gzipped once, ETag revalidation (304), 10-minute AQI cache with shared in-flight lookups, debounced rendering, cancellable AI requests, capped history and output tokens, no runtime dependencies |
| Testing | 30 `node:test` tests, about 99% line coverage (`npm run test:coverage`): AQI maths, sanitisers, plan rules, impact model, rate limiter, HTTP behaviour, and the Open-Meteo and Gemini paths with faked upstreams. CI runs lint, type-check and tests |
| Accessibility | Skip link, labelled fieldsets, 44 px targets, live regions (`role="status"`, `role="log"`), visible focus, AQI band shown as text not just colour, dark mode, reduced motion |

## Deploy
**Vercel** (static files from `public/`, API as serverless functions in `api/`):
```bash
npm i -g vercel
vercel login
vercel                                   # link and create a preview
vercel env add GROQ_API_KEY production   # or XAI_API_KEY / GEMINI_API_KEY
vercel env add LLM_PROVIDER production   # groq | xai | gemini
vercel env add LLM_MODEL production      # for example openai/gpt-oss-120b
vercel env add TRUST_PROXY production    # 1
vercel --prod
```
Do not name files `app.js`, `server.js` or `index.js` at the root or in `src/`: Vercel treats those names as server entry points and would run the browser script as a backend. That is why the server file is `backend.js` and the browser script is `src/client.js`.

Rate limits and the daily AI budget are kept in memory, so on serverless they apply per warm instance, not globally. Use a shared store such as Redis or Vercel KV for strict global limits.

**Any Node host** (Render, Railway, Fly): start command `npm start`; set one provider key and `TRUST_PROXY=1`. GitHub Pages cannot run the server.

## Disclaimer
General guidance, not medical advice. Impact figures are illustrative estimates with stated assumptions. Live AQI is estimated from PM2.5 using CPCB breakpoints and is not an official CPCB reading. Air-quality data: Open-Meteo (CC BY 4.0).
