# Swasthya

A calm wellness studio for the web. Eat well, move daily, rest deeply, all guided by one gentle coach.

*Swasthya* (स्वास्थ्य) means health in Sanskrit, in the sense of being "established in oneself".

## What it does

| | |
|---|---|
| **Today** | Two illustrated friends you can tap (five squats, then a warm smile), today's practice by day and a wind-down hero in the evening, a daily AI coach note, meal and rest cards, a daily check-in (water, sleep, mood), streak milestones |
| **Nourish** | A 3D bowl that fills as you eat. Snap a photo, type "2 eggs and toast", tap quick-add or "Again" chips for recent meals. Meals grouped by time of day, editable portions, Undo, 7-day chart, CSV export |
| **Move** | An illustrated demo and form cues for every exercise, a guided player (set timer, rests, spoken cues in a recorded voice, finish summary), adapt to how you feel, and a camera squat counter |
| **Restore** | Yoga nidra (5, 10 or 15 min) with both friends resting and a four-in/six-out breathing guide synchronized with the session, plus an optional wind-down reminder |
| **Progress** | Streak, monthly calendar, calories, protein, sleep and mood, weekly training, a weekly review and insights that appear once there is enough data |
| **Coach** | Chat that logs meals, adapts training and suggests the right tool from plain language |

Personal calorie and protein targets come from an optional body weight at onboarding. Evening tones warm the palette after wind-down time.

Everything works **offline and for free**: the site installs to the home screen and opens without a connection. Data stays in your browser (localStorage); Settings has Back up / Restore to move it between devices.

### Optional: free AI keys

Add either free key (no billing needed) to `apps/web/.env.local`:

- `GROQ_API_KEY` from [console.groq.com](https://console.groq.com/keys), tried first: coach chat, a daily coach note on Today, and photo meal estimates
- `GEMINI_API_KEY` from [Google AI Studio](https://aistudio.google.com/apikey): the same features as a fallback, plus live voice recovery (Gemini Live)

Without a key, or if a provider is unreachable on your network, each feature falls back on its own: a food picker, rule-based coaching, and the recorded guide voice.

### Guide voice

Workout cues and yoga nidra use pre-recorded clips from the open-source [Kokoro-82M](https://huggingface.co/hexgrad/Kokoro-82M) model (Apache-2.0, `bf_emma` voice), stored in `apps/web/public/audio/voice/`. The browser's speech engine is only a fallback for a line with no clip. After changing cue text in `lib/recovery.ts`, `lib/plan.ts` or `lib/voice-phrases.ts`, re-record offline:

```bash
KOKORO_DIR=/path/to/dir-with-kokoro-js node --experimental-strip-types scripts/record-voice.mjs
```

## Run it

```bash
npm run setup
```

```bash
cp apps/web/.env.example apps/web/.env.local
```

```bash
npm run dev
```

Live: **https://swasthya-bhavya.vercel.app** (Vercel; every push to `main` deploys).

Then open http://localhost:3000. AI keys in `.env.local` are optional.

Checks: `npm run lint`, `npm run typecheck`, `npm run build`.

## Characters

The approved original pair appears throughout onboarding, Today, Move, the workout player and yoga nidra. Local WebP posters and MP4 loops keep their faces, hair, outfits and proportions consistent. The camera stays fixed, including during squats; complete mats, hands and feet fit inside each scene.

`apps/web/src/components/characters/` contains one asset registry and one shared player. Clips pause when covered, offscreen or hidden; reduced motion shows the correct still. Decorative taps never log workouts. The original meal bowl remains a lazy WebGL scene. Superseded models and asset-generation work are archived locally under ignored `output/characters/`.

Check every referenced asset with `node scripts/check-character-assets.mjs`. These are illustrated movement examples, not a verified exercise-form assessment.

## Hosted portfolio

The ChatGPT Sites project identity is in `.openai/hosting.json`. A sanitized Vinext/Workers deployment is prepared under ignored `output/sites/swasthya/`; the canonical application remains `apps/web`. Hosting preserves browser-local data and stateless optional Gemini routes, and never includes `.env.local`. See `docs/SITES.md` for publishing details.

## Stack

Next.js 16 · React 19 · TypeScript · Tailwind CSS v4 · Framer Motion · three.js + React Three Fiber · `@google/genai` · MediaPipe Pose (loaded from CDN at runtime)

See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for how the pieces fit together.

## Notes

Meal numbers are rough estimates, not nutritional truth. Swasthya is not medical advice.

## License

MIT
