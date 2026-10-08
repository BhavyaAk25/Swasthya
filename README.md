# Swasthya

A calm wellness studio for the web. Eat well, move daily, rest deeply, all guided by one gentle coach.

*Swasthya* (स्वास्थ्य) means health in Sanskrit, in the sense of being "established in oneself".

## What it does

| | |
|---|---|
| **Today** | Greeting, today's practice, calorie and protein rings, evening reset countdown, 7-day rhythm |
| **Nourish** | Snap or upload a meal photo for an estimate, or type "2 eggs and toast". Quick-add chips, daily totals, 7-day chart, CSV export |
| **Move** | A weekly plan from your chosen rhythm. Tell it how you feel (tired, sore, short on time) and the session adapts. Check off moves, or count squats with your camera |
| **Restore** | Guided yoga nidra (5, 10 or 15 min) with a breathing orb and spoken cues. A gentle prompt appears at your wind-down time |
| **Coach** | Chat that logs meals, adapts training and opens the right tool from plain language |

Everything works **offline and for free**. Data stays in your browser (localStorage).

### Optional: free Gemini key

Add a free [Google AI Studio](https://aistudio.google.com/apikey) key (no billing needed) to unlock:

- photo meal estimates
- free-form coach answers
- live voice recovery sessions (Gemini Live)

Without a key, or if Google's API is unreachable on your network, each feature falls back on its own: a food picker, rule-based coaching, and the browser's built-in speech.

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

Then open http://localhost:3000. Setting `GEMINI_API_KEY` in `.env.local` is optional.

Checks: `npm run lint`, `npm run typecheck`, `npm run build`.

## Images

Every image area shows a soft placeholder. To use real photos, drop files into `apps/web/public/images/` and set their paths in [`apps/web/src/lib/images.ts`](apps/web/src/lib/images.ts).

## Stack

Next.js 16 · React 19 · TypeScript · Tailwind CSS v4 · Framer Motion · `@google/genai` · MediaPipe Pose (loaded from CDN at runtime)

See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for how the pieces fit together.

## Notes

Meal numbers are rough estimates, not nutritional truth. Swasthya is not medical advice.

## License

MIT
