---
name: release-site
description: Ship Swasthya changes. Verifies the app, pushes to GitHub and prepares the ChatGPT Sites copy so the live site (swasthya-wellness.bhavyaak.chatgpt.site) can be published from Codex. Use when the user says release, ship, deploy, publish or "push the changes to the site".
---

# Release Swasthya

The live site is on ChatGPT Sites. Pushing to GitHub does **not** update it; publishing happens in Codex. Do everything up to that point, then hand off.

1. **Notes:** add a dated entry to `CHANGELOG.md` for what changed (user-facing, short). Update `AGENTS.md`, `README.md`, `docs/ARCHITECTURE.md` or `HANDOFF.md` only where the change affects them.
2. **Verify and stage:** run `npm run release` from the repo root. It scans for keys, runs typecheck, lint, the Next build and the asset check, refreshes `output/sites/swasthya` and builds it. If it fails, fix the cause and rerun it; never skip steps.
3. **Commit and push:** stage everything except stray screenshots or anything under `output/`. Confirm `apps/web/.env.local` is not staged, then commit on `main` with a clear message and `git push origin main`.
4. **Check the live site:** `curl -s https://swasthya-wellness.bhavyaak.chatgpt.site/api/status`. A `provider` field means the current build is live; if it is missing, the site still needs publishing.
5. **Hand off:** tell the user it is ready and to say **"publish the Swasthya site"** in Codex (it follows `AGENTS.md › Releasing`). After they do, recheck step 4 and confirm.

Never put API keys in the Sites copy. AI on the live site needs a server-side secret set through Sites, not a file.
