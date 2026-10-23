# Swasthya character integration and portfolio deployment

## Current implementation

The owner approved the illustrated man and woman and the fixed-camera squat. The complete app now uses the same pair through Opus's existing scene interfaces. Layouts, navigation, meals, workout logging, daily check-ins, Progress and coach behavior remain in place.

- `apps/web/src/components/characters/assets.ts`: one registry for every exercise, including a separate pike push-up.
- `player.tsx`: one fixed-frame media player, correct poster fallback, offscreen/covered/hidden pausing, reduced-motion stills, guided breathing synchronization and recoverable hero playback errors.
- `scenes.tsx`: independent hero friends, exercise demonstrations and Restore.
- `components/three/index.tsx`: compatibility exports for the original views. Only `three/plate.tsx` lazily loads WebGL; `public/models/props.glb` is unchanged. The approved meal SVG is its loading/unavailable-WebGL fallback.
- `public/images/characters/`: selected WebP posters and compact local MP4 loops. No runtime image-generation, model inference, accounts or cloud user-data storage.

The two hero controls each raise their arms, perform five approved 2.4-second squats, then finish on the happy pose. Entry/exit are 0.6 seconds each; the rep counter excludes the entry. All states use the same fixed composition. Decorative interaction stores only the existing hint-seen preference and never logs workouts.

Restore includes a separate visible expanding/contracting breathing bloom below the people, with clear four-second inhale and six-second exhale cues. It pauses with playback and follows the same guided clock. The artwork retains subtle chest-only movement over a ten-second, four-in/six-out breathing cycle. Heads, hands, feet and mats remain still. Guided sessions supply a clock; playback follows naturally and corrects drift only when needed. No orb or tide badge overlays the people.

## Artwork contract

Keep the approved fictional identities: fair-skinned man with swept wavy brown hair and ivory tee; warm-brown woman with short dark curls and sage tee; loose moss trousers, barefoot. Preserve faces, hair, clothing and body proportions. No real names or likenesses.

Use `object-contain` and a fixed camera/scale through each movement. Complete heads, fingers, feet and mats must remain in frame at 375px and desktop sizes. Never fit the camera separately to each pose. Plank and hip opener now have their own moving loops: restrained isometric breath/hold and an anchored hip rock. Idle/happy remain deliberate still states. Movies are illustrated movement examples, not a verified exercise-form assessment.

Native art was produced with built-in ImageGen edits. Exact prompts, source PNGs, calibration, selected-frame QA and local assembly helpers are in ignored `output/characters/` (standing, floor, recovery and hero files). Successful native frames are preserved. Local MIT RIFE interpolation is used where sparse optical flow produced ghosts; inference code/weights are not runtime dependencies and do not ship. Some constrained single-source motion is used for small, stable movements. Controlled row range is documented in its assembly metadata. Dead bug uses an explicitly labeled leg-extension variation with both arms held vertical; the full arm-and-leg candidates remain archived because they produced arm transparency.

Superseded character models, Blender generators, prototype movies and the previous handoff are recoverably archived under `output/characters/legacy-assets/` and `legacy-source/`. They are not part of the production app.

## Checks and publishing

- `node scripts/check-character-assets.mjs` checks every registry asset and both friends.
- Run `npm run lint`, then `npm run typecheck` and `npm run build` sequentially (build regenerates Next types).
- Browser QA uses a synthetic Preview profile on 127.0.0.1, separate from localhost browser data. Desktop/375px images and findings go in `output/characters/qa/`.
- ChatGPT Sites identity is `.openai/hosting.json`; reuse it. Canonical application remains `apps/web`.
- `node scripts/prepare-sites.mjs` prepares an isolated, ignored Vinext/Workers checkout in `output/sites/swasthya/`. See `docs/SITES.md` for install/build/source-helper details.
- The owner explicitly requested public portfolio access. Do not include `.env.local`, private browser data or a developer Gemini key in the deployment. Local coaching/meal/recovery fallbacks work without a key.
- Source helper credentials belong only in session memory and hidden stdin. Its Git commits/pushes affect only the isolated Sites source, not the main GitHub checkout.

## Verified publication — October 15, 2026

Public portfolio URL: https://swasthya-wellness.bhavyaak.chatgpt.site

Sites version 1 deployed successfully from source commit `6b762f5e3b936d2ef98de19c39c41b0a13736107`. The saved source belongs to the isolated Sites repository. Main checkout changes remain available for review; the existing GitHub remote was not pushed.

- 38 selected nonempty media files cover 17 scene clips and both independently interactive friends; total character media is about 8 MiB. All native masters, rejected variants and local inference weights remain outside deployment.
- Lint, typecheck, Next production build, Sites/Workers build and asset coverage pass. Deployment archive matched the verified source and media; credential-like source scan found none.
- Browser checks confirmed local profile persistence, independent five-rep completion, background pausing, guided player pause/resume/set/rest controls, meal-to-Progress logging, recovery save/history, and keyless fallback coaching in the hosting runtime.
- Desktop and 375px layouts inspected; no horizontal overflow. Public welcome artwork decoded correctly and browser console had no errors. The published left hero completed its 13.2-second animation independently and exposed the replay control; the right friend remained idle.
- Row uses the documented controlled pull range. Dead bug is clearly labeled as a leg-extension variation with arms held steady; the rejected full arm-and-leg movies are archived. No blanket 10/10 or certified form claim is made.
- Public deployment has no developer Gemini key. Local coaching, food selection and guided recovery work; Gemini free-form/photo/Live upgrades require an optional server-side key. Camera and microphone hardware permissions were not exercised during this visual integration.

Selected media/prompt index: `output/characters/production-manifest.json`. Browser proof and verification notes: `output/characters/qa/`. Exact source publication record: `output/sites/deployment.json` (no credentials).

## October 15 visual corrections

- Hero movies no longer carry the moving beige/green plate. Offline contour mattes preserve the figures and mats while empty pixels become neutral white. Accurate chroma conversion keeps that plate neutral in browser video playback. `CharacterPlayer` paints the image/video into one canvas as backdrop × artwork with `blendPlate` (no CSS blend modes, which some browsers dropped); the white becomes the exact stage colour. Apply this only to assets prepared with white plates, never as a generic filter on other scenes. Both onboarding and Today use the same scene and continuous stage color.
- First/last hero posters have the same fixed composition as their matching movie endpoints. Keep the current `?v=edge5` on the changed hero filenames to avoid stale browser media. Original assets, comparison encodings and calibration script are preserved in `output/characters/background-fix/`. No per-frame pixel processing runs in the browser.
- `breathing-guide.tsx` is the small procedural SVG guide; its animation pauses while covered/offscreen/hidden. The guided overlay's duplicate breath label was removed. The graphic sits below the people, never over their bodies.
- New plank/hip loops and quantitative movement audit live in `output/characters/held-motion/`. Every exercise maps to a moving clip. Recovery body breathing remains intentionally subtle; the clear separate guide provides its visible cadence.
- Three unselected vector logo directions are in ignored `output/brand-review/index.html`: genuine Devanagari स्व monogram (recommended), opening lotus, and breath loop. Correctly shaped glyph paths use SIL-OFL Noto Serif Devanagari. These are review assets only; the owner subsequently chose option 2; the refined opening lotus is installed through `components/brand.tsx` and `public/brand/swasthya-lotus.svg`, including the favicon.
- Checks: lint, sequential typecheck/build, 38-file coverage, desktop idle/playback screenshots, correct hip playback, breathing phase/paused state and foreground/background gating. Website and logo review each measured 375px width with 375px scroll width in contained phone previews. Browser iframe control dispatch limited further phone interaction QA; main guided flow was verified on desktop.

Published correction release: Sites version 2, source `e0fd47f3cbf1792cc31da0fcab99fe9ca9f3801a`, deployment `appgdep_6ad15338608c8191ac44dd49ef717d89`, succeeded October 15, 2026. Same public URL and audience. Public hero media decoded and played with no console warnings/errors; the plate uses the expected multiply composite. Final proof: `output/characters/qa/oct15-fixes/published-welcome.png` and `published-phone.png`. Published hero completed independently at 13.2/13.2 seconds; the 375px welcome had no horizontal overflow. Character media is 7.68 MiB.

## Selected lotus and silhouette cleanup

The owner selected the opening lotus (option 2), refined into three balanced petals with clean negative space. A single transparent SVG is shared by the shell, welcome header and favicon through `components/brand.tsx`; the old animated green blob and generic favicon are retired. No new dependencies or logo animation.

The initial background contour matte retained small gray source-plate protrusions behind hair, shoulders and arms. `output/characters/edge-refinement/` now refines uncertain edges using continuous foreground interiors, while preserving the original pixels for faces, hair and clothing. Identical squat repetitions share masks to prevent residual video noise changing the silhouette; a three-frame mask median stabilizes moving boundaries. First/last posters use their exact corresponding corrected frames. All processing remains offline. Gray-patch comparison masters and previous production assets remain archived locally.

Fraunces and Manrope now load from their existing local licensed WOFF2 files under `src/app/fonts/` through `next/font/local`. This avoids a failing Google-font URL transform during the Next build and preserves the original font families. SIL OFL licenses are included.

Published selected-logo/edge-cleanup release: Sites version 3, source `43a8d63920faf9b6da6312bc6895ca86a93031b6`, deployment `appgdep_6ad159393d5881919c7f2f372e338577`, succeeded October 15, 2026. Current public URL is unchanged. Public welcome loads the lotus SVG, local fonts and `edge5` media. Both 1280px desktop and 375px phone screenshots were inspected; phone scrollWidth remains 375px and the logo renders at 32×32px. Corrected right-figure playback completed 13.2/13.2 seconds. Proof is in `output/characters/qa/lotus-edge/`.

## Squat motion correction

`output/characters/squat-smooth/assemble.py` and `dense.py` now own the hero and squat-demo motion. They rebuild from approved native poses before the legacy masked fabric blend. Recursive midpoint interpolation supplies close, native-anchored poses; measured head travel sets the cosine cadence, and small aligned steps keep exact image endpoints. Ascending frames reverse the same descent, and the floor stays pinned. Do not finish a rebuild with the superseded `hero_motion.py` or `edge-refinement/assemble.py` pipelines. Keep current `smooth6` cache keys on both hero and paired squat media.

`CharacterPlayer` now waits for the first presented video frame, displays one media layer at a time and has no video opacity fade. The previously loaded poster remains available as an immediate fallback, without showing an old pose underneath a moving frame. Offscreen/covered/hidden pause and reduced-motion behavior remain.

Hero timing remains five 2.4-second repetitions plus the physical 0.6-second entry and exit. Decorative interactions never write workout data. The selected lotus and other exercise assets remain in place.

Published squat-motion release: Sites version 4, source `41c0d69b315aa5891717499bd098ed65959ef42f`, deployment `appgdep_6ad1621616d88191b60afadc61c6f6f0`, succeeded October 15, 2026. Same public audience and URL. The selected source passes all build/coverage checks and its fixed-floor and reverse-motion checks have zero source pixel difference. Local browser verified full completion for both figures, a single visible media layer, and pause/resume without losing position. Detailed checks: `output/characters/qa/squat-smooth/verification.md`.

The app shell is explicitly `force-dynamic` so its HTML is not cached with obsolete JavaScript asset names between deployments. This does not move browser data to the server; application data remains localStorage. Static media and hashed JS assets retain their normal caching.

Final animation/cache release: Sites version 5, source `23794cc91b23c7cfac670c6a81668bada5750428`, deployment `appgdep_6ad16449a44c81919ccdaaaf64e0bfd5`, succeeded October 15, 2026. The local hosting Worker root responds 200 with `Cache-Control: no-store, must-revalidate`, replacing the long-lived static shell policy. Same public URL and audience; no developer key. Browser checks and source QA are recorded under `output/characters/qa/squat-smooth/`.

Final canonical URL now loads the current client build and smooth6 assets without a release query. Public playback completed 13.2/13.2; no new console warnings/errors appeared after deployment. The 375px phone check had no horizontal overflow. Final screenshots and motion preview are in `output/characters/qa/squat-smooth/`.

## October 15 fixes (Claude)

- Woman hero media (`woman-idle/happy.webp`, `woman-squat.mp4`) had a linen-coloured block behind her neck and hair that read as a dark blob; cleaned with `scripts/media/clean_plate.py` (originals in the Trash). Cache key `plate7`.
- Hero plate compositing moved from CSS `mix-blend-mode` to a canvas multiply (see `docs/ARCHITECTURE.md`); the squat demo now uses the plain path like the other exercise clips.
- Pushup, pike, deadbug, catcow, row, twist, fold and lunge were retimed with `scripts/media/retime.py` to remove freeze-then-jump motion; cache key `glide8`. The workout player keeps the upcoming move paused during rest (no idle still swap), and moves cross-fade.
- AI: Groq first (models discovered from the key's model list), Gemini fallback. Coach suggestions show as a button instead of auto-opening a tool.

## October 23 polish (Claude)

- All exercise/rest clips whitened with `scripts/media/normalize_plate.py` (cache key `flat9`; originals in the Trash) and rendered through the canvas plate on flat `stage-sage` / `stage-dusk` panels.
- Time-aware Today hero, evening tones, form cues (`lib/form.ts`, 14 new voice clips), weight-based targets, Undo, recent meals, portions, PWA, backup/restore, gated Progress insights, milestones, subset fonts. Details in `CHANGELOG.md`.

