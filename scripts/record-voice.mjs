#!/usr/bin/env node
/**
 * Pre-records every spoken phrase with Kokoro-82M (Apache-2.0), an open-source neural TTS,
 * so yoga nidra and the workout player use a natural voice offline with no runtime model.
 *
 * Kokoro is not an app dependency. Install it in a scratch folder and point KOKORO_DIR at it:
 *   mkdir /tmp/tts && cd /tmp/tts && npm init -y && npm i kokoro-js @breezystack/lamejs
 *   KOKORO_DIR=/tmp/tts node --experimental-strip-types scripts/record-voice.mjs
 *
 * Writes apps/web/public/audio/voice/<key>.mp3 and apps/web/src/lib/voice-manifest.json.
 * Only phrases that changed (or are missing) are recorded again.
 */
import { existsSync } from "node:fs";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
const web = path.join(root, "apps/web");
const lib = (name) => pathToFileURL(path.join(web, "src/lib", name)).href;

const { NIDRA_STEPS } = await import(lib("recovery.ts"));
const { CONSTRAINTS, SPLITS, adapt, weekFor } = await import(lib("plan.ts"));
const { buildSteps } = await import(lib("workout.ts"));
const { FIXED, nidraParts, phraseKey, restCue, workCue } = await import(lib("voice-phrases.ts"));

const VOICE = process.env.VOICE ?? "bf_emma";
const OUT = path.join(web, "public/audio/voice");
const MANIFEST = path.join(web, "src/lib/voice-manifest.json");

/* ------------------------------------------------------------ phrases (and their pace) */

const phrases = new Map(); // text -> speed
const add = (text, speed) => phrases.has(text) || phrases.set(text, speed);
for (const step of NIDRA_STEPS) for (const part of nidraParts(step.cue)) add(part, 0.8);
add(FIXED.rested, 0.8);
add(FIXED.complete, 0.95);
add(FIXED.restNext, 0.95);
for (const c of FIXED.count) add(c, 1);
for (const split of SPLITS) {
  for (const session of weekFor(split.id)) {
    for (const constraint of [undefined, ...CONSTRAINTS.map((c) => c.id)]) {
      const steps = buildSteps(adapt(session, constraint));
      for (const step of steps) {
        for (const p of workCue(step)) add(p, 0.95);
        for (const p of restCue(step)) add(p, 0.95);
      }
    }
  }
}

/* ------------------------------------------------------------ recording */

const kokoroDir = process.env.KOKORO_DIR;
if (!kokoroDir) throw new Error("Set KOKORO_DIR to a folder with kokoro-js and @breezystack/lamejs installed.");
/** ES module entry of a package installed in KOKORO_DIR (the CommonJS builds break the phonemizer). */
async function esm(name) {
  const dir = path.join(kokoroDir, "node_modules", name);
  const pkg = JSON.parse(await readFile(path.join(dir, "package.json"), "utf8"));
  const exp = pkg.exports ?? {};
  const entry = exp.node?.import ?? exp.default?.import ?? exp.import ?? (typeof exp.default === "string" ? exp.default : pkg.module ?? pkg.main);
  return import(pathToFileURL(path.join(dir, entry)).href);
}
const { KokoroTTS } = await esm("kokoro-js");
const lame = await esm("@breezystack/lamejs");

const previous = existsSync(MANIFEST) ? JSON.parse(await readFile(MANIFEST, "utf8")) : { voice: VOICE, clips: {} };
const clips = {};
await mkdir(OUT, { recursive: true });
let tts;

function encodeMp3(samples, rate) {
  const enc = new lame.Mp3Encoder(1, rate, 48);
  const pcm = new Int16Array(samples.length);
  for (let i = 0; i < samples.length; i++) pcm[i] = Math.max(-1, Math.min(1, samples[i])) * 0x7fff;
  const chunks = [];
  for (let i = 0; i < pcm.length; i += 1152) chunks.push(enc.encodeBuffer(pcm.subarray(i, i + 1152)));
  chunks.push(enc.flush());
  return Buffer.concat(chunks.map((c) => Buffer.from(c.buffer, c.byteOffset, c.byteLength)));
}

/** Trim leading/trailing near-silence, keeping a short natural tail. */
function trim(samples, rate) {
  const gate = 0.008;
  let a = 0;
  let b = samples.length - 1;
  while (a < b && Math.abs(samples[a]) < gate) a++;
  while (b > a && Math.abs(samples[b]) < gate) b--;
  return samples.subarray(Math.max(0, a - Math.round(rate * 0.03)), Math.min(samples.length, b + Math.round(rate * 0.12)));
}

for (const [text, speed] of phrases) {
  const key = phraseKey(text);
  const file = path.join(OUT, `${key}.mp3`);
  const old = previous.clips[key];
  if (old && old.text === text && old.speed === speed && previous.voice === VOICE && existsSync(file)) {
    clips[key] = old;
    continue;
  }
  tts ??= await KokoroTTS.from_pretrained("onnx-community/Kokoro-82M-v1.0-ONNX", { dtype: "q8", device: "cpu" });
  const audio = await tts.generate(text, { voice: VOICE, speed });
  const samples = trim(audio.audio, audio.sampling_rate);
  await writeFile(file, encodeMp3(samples, audio.sampling_rate));
  clips[key] = { text, speed, seconds: Math.round((samples.length / audio.sampling_rate) * 100) / 100 };
  console.log("recorded", key, clips[key].seconds + "s");
}

// Remove recordings that no phrase uses any more.
for (const key of Object.keys(previous.clips)) {
  if (!clips[key]) await rm(path.join(OUT, `${key}.mp3`), { force: true });
}
const sorted = Object.fromEntries(Object.entries(clips).sort(([a], [b]) => a.localeCompare(b)));
await writeFile(MANIFEST, JSON.stringify({ voice: VOICE, clips: sorted }, null, 2) + "\n");
console.log(`${Object.keys(sorted).length} phrases, voice ${VOICE}`);
