# ChatGPT Sites deployment

The canonical application is `apps/web`. `.openai/hosting.json` records the existing Site identity; reuse it rather than creating another Site. The isolated hosting checkout is ignored at `output/sites/swasthya/`, so the main Next.js project does not gain a second framework or deployment dependencies.

`node scripts/prepare-sites.mjs` copies only application source and selected public assets into that checkout and retains the supported Sites/Vinext/Workers runtime. It never copies `.env.local`, browser storage, Git history, working screenshots or asset-generation experiments. An optional first argument or `SITES_PLUGIN_ROOT` selects the installed Sites plugin directory.

When dependency inputs change, update the hosting lockfile with `npm install --package-lock-only --ignore-scripts --no-audit --no-fund` in the hosting checkout, then run the Sites `install-dependencies.mjs` helper there. Build with the plugin's `build-site.mjs`. The production Worker can be tested locally using the hosting checkout's `npm run start -- --port 8787`.

Use the Sites source workflow helper with a fresh repository credential supplied through hidden stdin. Open the existing Site source first, retain its returned checkout result, then package with the remaining build/check commands and an absolute archive path. Publish the exact returned commit and archive through Sites. Credentials must remain in session memory; never put them in command arguments, files or Git configuration. This workflow commits only the isolated Sites source; it does not push the main GitHub repository.

The owner requested public portfolio access. Keep all user data in browser localStorage. The hosted app works without a Gemini key through its existing local fallbacks; no developer key is included in the source or deployment. Gemini can be configured later as a server-side runtime secret, with the existing schema validation and fallback behavior retained.
