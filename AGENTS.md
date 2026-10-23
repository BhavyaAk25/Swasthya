# AGENTS.md

## Product
Swasthya is a calm, minimalist wellness website for meals (Nourish), training (Move), recovery (Restore), progress and a coach chat. Two illustrated friends in the approved stylised 3D aesthetic demonstrate and react throughout. It is responsive: sidebar on desktop, bottom tabs on phones.

## Hard rules
- **Free and local.** No paid APIs, no cloud services, no accounts. All user data lives in browser `localStorage` (`lib/store.ts`).
- **AI is optional.** Free Groq or Gemini keys only upgrade features; call providers through `askJson` in `lib/server/ai.ts` (Groq first, then Gemini). Every AI feature must keep working offline through its fallback (see `docs/ARCHITECTURE.md`).
- **AI keys are server-side only.** Never expose `GROQ_API_KEY` or `GEMINI_API_KEY`. Live voice uses single-use ephemeral tokens.
- **Validate everything on the server.** Use zod on input and output, cap lengths, keep user text out of system instructions, and never echo provider errors.
- **Decorative character interactions never write workout data.** Tapping the characters is play; only explicit actions (guided player, checklist, camera counter) log workouts.
- Never commit secrets. `.env.local` is gitignored.
- Meal numbers are estimates. No medical claims. The characters are original and unnamed; don't use real people's names or likeness.

## Characters and the meal bowl
- Approved fictional identities: fair-skinned man with swept brown hair/ivory tee, warm-brown woman with short dark curls/sage tee; both wear loose moss trousers and are barefoot.
- Local artwork and seamless motion clips live in `apps/web/public/images/characters/`. Keep the approved faces, hair, clothes and proportions consistent across every asset.
- `components/characters/assets.ts` maps all exercises to their own poster/loop. Pike has its own clip; never substitute a push-up or standing figure for a different exercise.
- `CharacterPlayer` is the shared fixed-frame player: `object-contain`, no animated zoom or crop, pause offscreen/covered/hidden, keep playback position, respect reduced motion, show the correct poster when media fails.
- Every character asset (hero, exercises, rest) has a pure white (255) background. `CharacterPlayer`’s `blendPlate` paints it into a canvas as backdrop × artwork, so it matches the colour behind it exactly and repaints when evening tones switch (`data-mode` on `<html>`). Scenes therefore sit on **flat** stages (`bg-bg`, `bg-stage-sage`, `bg-stage-dusk`), never gradients. Never reintroduce CSS `mix-blend-mode` for media. Keep the paint order in `player.tsx` (draw artwork, then `multiply` + `fillRect` the backdrop): Safari ignores composite modes on `drawImage(video)`. New clips: whiten with `scripts/media/normalize_plate.py` (soft plates) or `clean_plate.py` (patches); check with a contrast boost.
- Exercise loops must move at an even pace (no freeze-then-jump); `scripts/media/retime.py` evens them without changing loop length. Bump the `?v=` key after replacing media.
- Hero friends are independently tappable: five decorative squat repetitions, then happy. Only the hint-seen preference is stored; taps never log workouts.
- Restore is a ten-second breathing loop (four in, six out), synchronized to the guided session. A separate visible inhale/exhale bloom sits below the people; no orb/tide badge over their bodies.
- The existing `components/three/index.tsx` exports remain compatibility entry points for Opus's layouts. Only the meal bowl in `three/plate.tsx` loads WebGL; its geometry remains `public/models/props.glb`. Never hand-edit GLB files.
- Asset masters, exact prompts, calibration and superseded files live in ignored `output/characters/` and `output/visual-review/`; only selected production files ship.
- Check asset coverage with `node scripts/check-character-assets.mjs`.

## Form, voice and evening
- Form guidance (three cues and one thing to avoid) for every move lives in `lib/form.ts`; the first cue is spoken on a move's first set, so recording must be rerun after editing it.
- Evening tones: `:root[data-mode="evening"]` in `globals.css` overrides the palette from an hour before the reset time until 5 am (`dayPart` in `lib/utils.ts`); users can turn it off in Settings.

## Voice
- Spoken cues are pre-recorded Kokoro-82M clips (`bf_emma`) in `public/audio/voice/`, listed in `lib/voice-manifest.json`. Build cue text only through `lib/voice-phrases.ts` so app and recorder agree.
- Play through `say()` in `lib/voice.ts`; it falls back to `speechSynthesis` for unrecorded lines. After changing cue text, re-run `scripts/record-voice.mjs` (see README).
- Dev QA in a hidden browser tab: `/?forcerender` skips UI animation delays. Verify actual video playback separately.

## Design
- Brand: the selected refined opening lotus is `public/brand/swasthya-lotus.svg`, shared by `components/brand.tsx` and metadata favicon. Keep it static and preserve the Fraunces wordmark.
- Light theme, warm linen background, moss/sage/clay palette, Fraunces display + Manrope body.
- Minimal text. Fluid motion: use the shared `calm` spring and `Sheet` from `components/ui.tsx`. No hard cuts and no bounce.
- No horizontal scroll at 375px. Grid children need `min-w-0`.
- Base CSS goes in `@layer base` so Tailwind utilities win.

## Commands
```bash
npm run setup
npm run dev
npm run lint
npm run typecheck
npm run build
```
Run typecheck and build one after the other (the build regenerates `.next/types`).

## Offline and data
- `app/manifest.ts` + `public/sw.js` make the site installable and usable offline (shell network-first, static media cache-first, never `/api` or videos). Bump `VERSION` in `sw.js` when its caching rules change.
- Undo uses `actions.withUndo(fn)` (snapshot before, restore on Undo); Back up / Restore in Settings round-trip the whole store through the same `sanitize()` used on load.

## Releasing
The live site is **https://swasthya-bhavya.vercel.app** (Vercel project `swasthya`, team "Bhavya's projects", root directory `apps/web`). It is linked to GitHub: **every push to `main` deploys to production automatically**; other branches get private preview URLs.
1. `npm run release` (secret scan, typecheck, lint, Next build, asset check). Fix anything it reports.
2. Commit and push `main`. Then confirm the deployment is Ready (Vercel dashboard or connector) and that `https://swasthya-bhavya.vercel.app/api/status` responds.
- `GROQ_API_KEY` (and optionally `GEMINI_API_KEY`) live only in Vercel › Project › Settings › Environment Variables. Never commit them; after changing one, redeploy.
- The older ChatGPT Sites copy (`docs/SITES.md`, `npm run release -- --sites`) is legacy.

## Layout
- `apps/web/src/components/app.tsx`: shell, navigation, overlay routing, recovery nudge, character still preloading
- `apps/web/src/components/views/`: Today, Nourish, Move, Restore, Progress, Onboarding
- `apps/web/src/components/overlays/`: meal capture, workout player, squat tracker, recovery session, live voice, coach, settings
- `apps/web/src/components/characters/`: illustrated scenes and shared player
- `apps/web/src/components/three/`: meal bowl stage and compatibility exports
- `apps/web/src/components/checkin.tsx`: daily water / sleep / mood
- `apps/web/src/lib/`: store, foods, plan, workout parsing, coach rules, recovery script, voice, utils; `lib/server/` holds the AI provider layer
- `apps/web/src/app/api/`: `status`, `meal`, `coach`, `note`, `live`
