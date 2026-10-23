# Changelog

## 2026-10-23: Safari fix
- Safari showed a white box behind every moving character (exercise demos, rest scene, a tapped friend). WebKit ignores the canvas blend mode when drawing a video frame, so the player now draws the frame first and multiplies the page colour over it with `fillRect`, which every browser honours. Verified in WebKit and Chrome.

## 2026-10-23: Polish pass
### Looks
- Every exercise and rest scene now stands directly on its panel, with no white or beige box: all clips were whitened (`scripts/media/normalize_plate.py`) and render through the canvas plate on flat stage colours.
- Today follows the clock: from wind-down time the hero becomes "Wind down" with the friends resting, and the reset is labelled Today / Tonight / Tomorrow correctly.
- Evening tones: a warmer, softer palette after wind-down (Settings can turn it off).
- Nourish: the bowl is the full-width hero (stock photo removed).
- Streak milestones (3, 7, 14, 21, 30, 50, 100 days) celebrate with both friends' happy pose; light haptics on phones.
- Fonts subset to what the site uses: 242 KB down to 100 KB.

### Use
- Personal calorie and protein targets from an optional weight at onboarding (kg or lb).
- Form cues and one common mistake for all 14 moves, on Move and in the player; the key cue is spoken (14 new Kokoro clips).
- Undo for logging and removing meals and for "Mark done"; one session button on Move.
- Nourish: "Again" chips for recent meals, meals grouped by time of day, change a portion after logging.
- Installable app with offline support; optional wind-down reminder notification.
- Back up / Restore all data from Settings.
- Progress: best day only after three active days; insights (sleep vs mood, protein trend, training day) only once there is enough data.

### AI
- The daily coach note follows the time of day: rest only late at night (enforced on the server), wind-down in the evening, a welcome on day one.

## 2026-10-15: Live on Vercel
- The site is now hosted on Vercel at https://swasthya-bhavya.vercel.app, linked to GitHub. Every push to `main` deploys, with no separate publish step.
- `npm run release` now only verifies (the ChatGPT Sites steps moved behind `--sites`). The `/release-site` skill pushes and confirms the Vercel deployment.
- The Groq key is set as a Vercel environment variable, so the AI coach works on the live site.

## 2026-10-15: Release tooling
- `npm run release` runs a secret scan, typecheck, lint, the Next build and the asset check, then refreshes and builds the ChatGPT Sites copy (`scripts/release.mjs`).
- `/release-site` skill (`.claude/skills/release-site/`) and an `AGENTS.md › Releasing` section. Pushing to GitHub does not update the live site; publishing is one step in Codex ("publish the Swasthya site").

## 2026-10-15: Illustrated characters, smoother sessions, free AI coach

### Characters and rendering
- Codex's illustrated friends replace the 3D figures: local WebP posters and MP4 loops for every exercise, the hero, and yoga nidra (`components/characters/`). The only WebGL left is the meal bowl.
- Fixed a dark blob behind the woman: her hero media had a linen block baked in behind her neck and hair. It is cleaned in all three files (`scripts/media/clean_plate.py`).
- Fixed one friend's background turning white when tapped. Hero media is now painted into a canvas as backdrop × artwork instead of CSS `mix-blend-mode`, which some browsers dropped for animating layers.
- Fixed the meal bowl flashing a full plate before showing the real (empty) bowl.

### Movement and sessions
- Eight exercise loops (pushup, pike, deadbug, catcow, row, twist, fold, lunge) were retimed to remove freeze-then-jump motion, keeping their length (`scripts/media/retime.py`).
- The workout player keeps the upcoming move paused and preloaded during rest (it starts about 50 ms after rest ends), and moves cross-fade instead of cutting.
- Restore logs only the minutes actually played (skips no longer count), and closing mid-session keeps the progress.
- Space no longer pauses when a button has focus, a double tap can't log a meal twice, and "Start over" closes Settings.

### Voice
- Workout cues and yoga nidra use pre-recorded clips from the open-source Kokoro-82M voice (`bf_emma`, Apache-2.0) instead of the robotic browser voice (`lib/voice.ts`, `scripts/record-voice.mjs`).

### AI (free, optional)
- Groq is tried first, with Gemini as fallback (`lib/server/ai.ts`). Models are picked from what the key can use, so retired models no longer break the coach.
- The coach chat sees a structured summary of the day and recent days. Suggestions appear as a button instead of auto-opening a tool, and offline replies cover sleep, stress, pain, water and more.
- A new daily coach note on Today (`/api/note`), cached per day and state.
- Meal photo estimates can be cancelled ("Pick foods instead") and time out after 30 seconds.
- Provider errors are never echoed to the browser; all input and output is validated with zod.

### Cleanup
- Removed the proof page, unused stills, components, CSS and exports, and leftover Blender config.
- Saved data is validated field by field (a damaged training plan no longer crashes the app). The day rolls over at midnight, and repeated toasts show again.
- Preview servers can use `NEXT_DIST_DIR` so they don't lock out `npm run dev`.
