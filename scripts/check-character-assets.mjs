#!/usr/bin/env node
// Check deployed assets against the shared registry without importing browser or TypeScript code.
import { readFile, stat } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const registry = await readFile(new URL("../apps/web/src/components/characters/assets.ts", import.meta.url), "utf8");
const entries = [...registry.matchAll(/\b(still|motion)\("([a-z]+)"/g)];
if (!entries.length) throw new Error("No character assets found in the registry.");

const files = new Set();
for (const [, kind, clip] of entries) {
  files.add(`${clip}.webp`);
  if (kind === "motion") files.add(`${clip}.mp4`);
}
for (const who of ["man", "woman"]) {
  files.add(`${who}-idle.webp`);
  files.add(`${who}-happy.webp`);
  files.add(`${who}-squat.mp4`);
}

let failed = false;
for (const file of files) {
  const url = new URL(`../apps/web/public/images/characters/${file}`, import.meta.url);
  try {
    const info = await stat(url);
    if (!info.isFile() || info.size === 0) throw new Error("empty or invalid file");
  } catch {
    failed = true;
    console.error(`Missing or empty character asset: ${fileURLToPath(url)}`);
  }
}
if (failed) process.exitCode = 1;
else console.log(`Verified ${files.size} nonempty character assets for ${entries.length} scene clips and both friends.`);
