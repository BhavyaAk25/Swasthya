"use client";

import manifest from "@/lib/voice-manifest.json";
import { phraseKey } from "@/lib/voice-phrases";

/**
 * Natural guidance voice. Plays pre-recorded Kokoro clips (scripts/record-voice.mjs) one after
 * another; if any phrase has no recording, the whole line falls back to the browser's speech
 * synthesis so nothing is ever silently skipped. One line plays at a time; a new line or
 * cancel() stops the current one.
 */

const CLIPS = manifest.clips as Record<string, { seconds: number }>;
const DIR = "/audio/voice";

let generation = 0;
let audio: HTMLAudioElement | null = null;
let gapTimer: ReturnType<typeof setTimeout> | null = null;

export function voiceSupported() {
  return typeof window !== "undefined" && (typeof Audio !== "undefined" || "speechSynthesis" in window);
}

export function hasRecording(text: string) {
  return phraseKey(text) in CLIPS;
}

function stopAll() {
  if (gapTimer) clearTimeout(gapTimer);
  gapTimer = null;
  if (audio) {
    audio.onended = null;
    audio.onerror = null;
    audio.pause();
  }
  if (typeof window !== "undefined" && "speechSynthesis" in window) window.speechSynthesis.cancel();
}

/** Stop whatever is being said. */
export function cancelVoice() {
  generation += 1;
  stopAll();
}

function synthFallback(text: string, rate: number) {
  if (!("speechSynthesis" in window)) return;
  const synth = window.speechSynthesis;
  const u = new SpeechSynthesisUtterance(text);
  const voices = synth.getVoices().filter((v) => v.lang.startsWith("en"));
  const preferred = ["Serena", "Google UK English Female", "Samantha", "Karen", "Moira", "Microsoft Libby", "Microsoft Sonia"];
  const v = voices.find((x) => preferred.some((p) => x.name.includes(p))) ?? voices.find((x) => x.localService) ?? voices[0];
  if (v) {
    u.voice = v;
    u.lang = v.lang;
  }
  u.rate = rate;
  u.volume = 0.9;
  synth.speak(u);
}

/**
 * Say a line made of phrases. `gap` is the pause between phrases in seconds.
 * Resolves when finished or interrupted.
 */
export function say(parts: readonly string[], { gap = 0.12, volume = 0.95, fallbackRate = 0.92 } = {}): Promise<void> {
  if (typeof window === "undefined" || !parts.length) return Promise.resolve();
  cancelVoice();
  const id = generation;
  const keys = parts.map(phraseKey);
  if (!keys.every((k) => k in CLIPS) || typeof Audio === "undefined") {
    synthFallback(parts.join(" "), fallbackRate);
    return Promise.resolve();
  }
  audio ??= new Audio();
  const player = audio;
  player.volume = volume;
  return new Promise((resolve) => {
    const playAt = (i: number) => {
      if (id !== generation) return resolve();
      if (i >= keys.length) return resolve();
      player.onended = () => {
        if (id !== generation) return resolve();
        gapTimer = setTimeout(() => playAt(i + 1), gap * 1000);
      };
      player.onerror = () => {
        // A missing or blocked file: say the rest with the fallback voice.
        if (id === generation) synthFallback(parts.slice(i).join(" "), fallbackRate);
        resolve();
      };
      player.src = `${DIR}/${keys[i]}.mp3`;
      void player.play().catch(() => {
        // Autoplay blocked (no user gesture yet): fall back once rather than stay silent.
        if (id === generation) synthFallback(parts.slice(i).join(" "), fallbackRate);
        resolve();
      });
    };
    playAt(0);
  });
}

const prefetched = new Set<string>();

/** Warm the browser cache for lines that are about to be spoken. */
export function prefetchVoice(parts: readonly string[]) {
  if (typeof window === "undefined") return;
  for (const p of parts) {
    const key = phraseKey(p);
    if (!(key in CLIPS) || prefetched.has(key)) continue;
    prefetched.add(key);
    const link = document.createElement("link");
    link.rel = "prefetch";
    link.as = "audio";
    link.href = `${DIR}/${key}.mp3`;
    document.head.appendChild(link);
  }
}
