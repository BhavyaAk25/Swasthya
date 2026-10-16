---
name: release-site
description: Ship Swasthya changes to the live site (https://swasthya-bhavya.vercel.app on Vercel). Verifies the app, records the changes, pushes main (which auto-deploys) and confirms the deployment. Use when the user says release, ship, deploy, publish or "push the changes to the site".
---

# Release Swasthya

The site is on Vercel, linked to GitHub `BhavyaAk25/Swasthya` (root `apps/web`). A push to `main` deploys to production automatically.

1. **Notes:** add a short dated entry to `CHANGELOG.md`. Update `AGENTS.md`, `README.md`, `docs/ARCHITECTURE.md` or `HANDOFF.md` only where the change affects them.
2. **Verify:** run `npm run release` from the repo root. It runs a secret scan, typecheck, lint, the Next build and the asset check. If it fails, fix the cause and rerun it; never skip steps.
3. **Commit and push:** stage everything except stray screenshots and `output/`. Confirm `apps/web/.env.local` is not staged, then commit on `main` with a clear message and `git push origin main`.
4. **Confirm the deploy:** with the Vercel connector (team `team_AhdJpc11dkMzITQTNJUvGzsn`, project `swasthya`), find the deployment for the pushed commit and wait until it is `READY`; if it is `ERROR`, read the build logs, fix and push again. Then check `curl -s https://swasthya-bhavya.vercel.app/api/status` (`"ai": true` means the Groq key is set).
5. **Report** the live URL and what changed.

Keys (`GROQ_API_KEY`, optional `GEMINI_API_KEY`) live only in Vercel › swasthya › Settings › Environment Variables. Never put them in the repo or the chat; after the user changes one, redeploy.
