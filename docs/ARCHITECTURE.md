# Architecture

```
Browser (all state, all fallbacks)                     Next.js server (stateless, optional AI)
─────────────────────────────────                      ──────────────────────────────────────
components/app.tsx      shell, nav, overlays, nudge    GET  /api/status  → { ai, live, provider }
components/views/*      Today · Nourish · Move · …     POST /api/meal    photo → estimate
components/overlays/*   camera, player, nidra, chat    POST /api/coach   message + day context → reply
components/coach-note   Today's one-line suggestion    POST /api/note    day context → short note
components/characters/* fixed-camera illustrated people
components/three/*      lazy WebGL meal bowl
lib/store.ts            localStorage store + actions   POST /api/live    → single-use Live token
lib/foods.ts            food table + text parser                │
lib/plan.ts             weekly plans + adaptations              ▼
lib/coach.ts            local intent rules              lib/server/ai.ts: Groq first, then Gemini
lib/recovery.ts         yoga nidra script               (free keys; live voice is Gemini only)
lib/voice.ts            recorded-clip voice player
```

## Principles

- **Client owns the data.** One versioned JSON blob in `localStorage` (`swasthya:v2`), with bounded messages and meal photos. No accounts, database or cloud.
- **AI is an upgrade, never a dependency.** `/api/status` reports `ai: true` only when a provider key is set *and* that provider's host is reachable (checked with a cached HEAD request). `askJson` in `lib/server/ai.ts` tries Groq (OpenAI-compatible JSON mode, Llama 4 Scout for photos), then Gemini, and validates the result with the route's zod schema. Every AI path has an offline twin:
  - meal photo → food picker (`lib/foods.ts`)
  - coach → local intents (`lib/coach.ts`) + canned replies
  - coach note → check-in rules (`checkInHint`) or no card
  - live voice → guided session with the recorded voice
- **Local first, then AI.** The coach runs deterministic intents first (log a meal, adapt the workout, open a tool), so common requests are instant and predictable. Questions go to the AI with a structured summary of the day (`coachContext` in `lib/store.ts`, re-validated by `lib/server/context.ts`).
- **Recorded voice.** Cue lines are built in `lib/voice-phrases.ts` and recorded offline with Kokoro-82M (`scripts/record-voice.mjs`) into `public/audio/voice/` with a manifest. `lib/voice.ts` plays clips in sequence and falls back to `speechSynthesis` for any line without a clip.
- **Server is a thin, validated proxy.** Every route validates input with zod and caps sizes. User text is cleaned and placed in tagged blocks, separate from the system instruction. Model output is schema-validated before it reaches the client, and provider errors are never echoed.
- **Live voice never exposes the key.** `/api/live` mints a single-use, short-lived token that is locked to one model and system instruction.
- **Squat counter** loads MediaPipe Pose from jsDelivr and the model from Google Storage at runtime, so no WASM ships in the repo.

## Character media

`components/characters/assets.ts` maps every plan exercise to its approved WebP poster and optional MP4 loop. `CharacterPlayer` is shared by the hero, exercise demonstrations and recovery; all media uses a fixed composition with `object-contain`. Hero movies are separate for each friend, count five decorative repetitions and finish on that friend's happy still. The ten-second rest movie and separate SVG breathing guide synchronize with the guided session's four-in/six-out clock. Hero assets have neutral white plates. With `blendPlate`, the player paints each still and video frame into one 2D canvas as *backdrop colour × artwork* (canvas `multiply`), using the opaque colour behind the scene, so the plate becomes exactly that colour in every browser. There are no CSS blend modes: some browsers drop `mix-blend-mode` for an animating layer, which showed a white panel (or a black block) behind one friend. The invisible `<video>` only decodes; `requestVideoFrameCallback` paints each new frame once. Exercise clips carry their own soft beige plate and use the plain poster/video path. Plank and hip opener have dedicated held-pose motion loops.

Scenes do not log workouts. Videos pause when offscreen, hidden or covered and resume from the same position. Reduced motion and media failures show the correct scene poster. The only remaining WebGL model is the original meal bowl, loaded lazily through `components/three/plate.tsx`.

The Next.js source also builds in a sanitized Vinext/Cloudflare Workers checkout for ChatGPT Sites. Data stays in browser localStorage, and server routes remain optional validated proxies; no personal browser data or local secrets are published.

## Motion

One shared spring (`calm` in `components/ui.tsx`) drives every movement: no bounce, about 300ms. Colour and shadow changes ease through a global transition. `prefers-reduced-motion` is respected.
