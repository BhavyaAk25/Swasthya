/**
 * Every phrase the app speaks, as a list of short clips. Shared by the browser player
 * (lib/voice.ts) and the offline recorder (scripts/record-voice.mjs), so a phrase that is
 * spoken always has a matching recording. Keep this file free of non-type imports.
 */

import type { Step } from "./workout";

export const FIXED = {
  restNext: "Rest. Next,",
  complete: "Session complete. Well done.",
  rested: "Well rested. Take your time getting up.",
  count: ["One.", "Two.", "Three."] as const,
};

/** "40 seconds", "2 minutes", "12 reps", "10 each side". */
export function targetPhrase(step: Pick<Step, "kind" | "reps" | "perSide" | "seconds">) {
  if (step.kind === "time") {
    const sec = step.seconds ?? 0;
    const base = sec >= 60 && sec % 60 === 0 ? `${sec / 60} minute${sec === 60 ? "" : "s"}` : `${sec} seconds`;
    return `${base}${step.perSide ? " each side" : ""}.`;
  }
  return step.perSide ? `${step.reps} each side.` : `${step.reps} reps.`;
}

/** Name, set and target; on the first set, also the move's key form cue (lib/form.ts). */
export function workCue(step: Step, formCue?: string): string[] {
  const parts = [`${step.name}.`, `Set ${step.set} of ${step.totalSets}.`, targetPhrase(step)];
  return step.set === 1 && formCue ? [...parts, formCue] : parts;
}

export function restCue(next: Step): string[] {
  return [FIXED.restNext, `${next.name}.`];
}

/** Yoga nidra cues are spoken sentence by sentence with unhurried pauses between them. */
export function nidraParts(cue: string): string[] {
  return cue.split(/(?<=[.!?])\s+/).map((s) => s.trim()).filter(Boolean);
}

/** Stable file name for a phrase. */
export function phraseKey(text: string) {
  return text
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[–—]/g, "-")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}
