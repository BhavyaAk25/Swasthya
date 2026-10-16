# Changelog

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
