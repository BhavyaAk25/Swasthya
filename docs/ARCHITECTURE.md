# Architecture

```
Browser (all state, all fallbacks)                     Next.js server (stateless, optional AI)
─────────────────────────────────                      ──────────────────────────────────────
components/app.tsx      shell, nav, overlays, nudge    GET  /api/status  → { ai, live }
components/views/*      Today · Nourish · Move · …     POST /api/meal    photo → estimate
components/overlays/*   camera, squats, nidra, chat    POST /api/coach   message → reply + action
lib/store.ts            localStorage store + actions   POST /api/live    → single-use Live token
lib/foods.ts            food table + text parser                │
lib/plan.ts             weekly plans + adaptations              ▼
lib/coach.ts            local intent rules              Gemini API (free AI Studio key)
lib/recovery.ts         yoga nidra script
```

## Principles

- **Client owns the data.** One versioned JSON blob in `localStorage` (`swasthya:v2`), with bounded messages and meal photos. No accounts, database or cloud.
- **AI is an upgrade, never a dependency.** `/api/status` reports `ai: true` only when a key is set *and* Google's API host is reachable. Every AI path has an offline twin:
  - meal photo → food picker (`lib/foods.ts`)
  - coach → local intents (`lib/coach.ts`) + canned replies
  - live voice → guided session with browser `speechSynthesis`
- **Local first, then AI.** The coach runs deterministic intents first (log a meal, adapt the workout, open a tool), so common requests are instant and predictable. Questions go to Gemini.
- **Server is a thin, validated proxy.** Every route validates input with zod and caps sizes. User text is cleaned and placed in tagged blocks, separate from the system instruction. Model output is schema-validated before it reaches the client, and provider errors are never echoed.
- **Live voice never exposes the key.** `/api/live` mints a single-use, short-lived token that is locked to one model and system instruction.
- **Squat counter** loads MediaPipe Pose from jsDelivr and the model from Google Storage at runtime, so no WASM ships in the repo.

## Motion

One shared spring (`calm` in `components/ui.tsx`) drives every movement: no bounce, about 300ms. Colour and shadow changes ease through a global transition. `prefers-reduced-motion` is respected.
