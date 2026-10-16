#!/usr/bin/env node
/**
 * Release prep: verify the app, then stage and build the ChatGPT Sites copy.
 *
 *   npm run release            checks + prepare + build the Sites copy
 *   npm run release -- --quick skip the Next production build (Sites build still runs)
 *
 * It never commits, pushes or publishes. Pushing to GitHub does not update the live Site;
 * publishing is done in Codex with the Sites plugin (see AGENTS.md, "Releasing").
 */
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
const web = path.join(root, "apps/web");
const site = path.join(root, "output/sites/swasthya");
const quick = process.argv.includes("--quick");

const step = (label, cmd, args, cwd = root) => {
  process.stdout.write(`\n▸ ${label}\n`);
  try {
    execFileSync(cmd, args, { cwd, stdio: "inherit" });
  } catch {
    console.error(`\n✗ ${label} failed. Fix it and run the release again.`);
    process.exit(1);
  }
};

// 1. Never ship secrets: refuse if a key-like string is tracked or staged.
const tracked = execFileSync("git", ["ls-files", "-co", "--exclude-standard"], { cwd: root, encoding: "utf8" }).split("\n").filter(Boolean);
const keyLike = /gsk_[A-Za-z0-9]{20,}|AIza[0-9A-Za-z_-]{30,}|sk-[A-Za-z0-9]{30,}/;
const leaks = tracked.filter((file) => {
  if (!/\.(ts|tsx|js|mjs|json|md|env|example|txt|py)$/.test(file)) return false;
  try {
    return keyLike.test(readFileSync(path.join(root, file), "utf8"));
  } catch {
    return false;
  }
});
if (leaks.length) {
  console.error(`✗ Key-like strings found in: ${leaks.join(", ")}. Remove them before releasing.`);
  process.exit(1);
}

// 2. Verify the canonical app.
step("Typecheck", "npx", ["tsc", "--noEmit"], web);
step("Lint", "npx", ["eslint", "."], web);
if (!quick) step("Next production build", "npx", ["next", "build"], web);
step("Character assets", process.execPath, [path.join(root, "scripts/check-character-assets.mjs")]);

// 3. Stage the Sites copy and build it with its own toolchain.
step("Prepare Sites copy", process.execPath, [path.join(root, "scripts/prepare-sites.mjs")]);
if (!existsSync(path.join(site, "node_modules"))) {
  console.error("\n✗ The Sites copy has no node_modules. Ask Codex to install its dependencies with the Sites plugin first.");
  process.exit(1);
}
const appDeps = JSON.parse(readFileSync(path.join(web, "package.json"), "utf8")).dependencies;
const lock = readFileSync(path.join(site, "package-lock.json"), "utf8");
const missing = Object.keys(appDeps).filter((name) => !lock.includes(`"node_modules/${name}"`));
if (missing.length) {
  console.error(`\n✗ New dependencies not installed in the Sites copy: ${missing.join(", ")}. Ask Codex to refresh its lockfile and install (docs/SITES.md).`);
  process.exit(1);
}
step("Build Sites copy", "npm", ["run", "build"], site);

const head = execFileSync("git", ["rev-parse", "--short", "HEAD"], { cwd: root, encoding: "utf8" }).trim();
const dirty = execFileSync("git", ["status", "--porcelain"], { cwd: root, encoding: "utf8" }).trim();
console.log(`
✓ Ready to publish (main @ ${head}${dirty ? ", with uncommitted changes" : ""}).

Next:
  1. Commit and push to GitHub (keeps the code safe; it does NOT update the live site).
  2. In Codex, say:  publish the Swasthya site
     Codex follows AGENTS.md › Releasing: it packages output/sites/swasthya with the Sites
     source helper and deploys to https://swasthya-wellness.bhavyaak.chatgpt.site
`);
