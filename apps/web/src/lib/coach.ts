import { estimateFromItems, parseFoodText } from "@/lib/foods";
import type { CoachAction, Constraint, MealEstimate } from "@/lib/types";

export type LocalIntent =
  | { kind: "meal"; estimate: MealEstimate }
  | { kind: "adapt"; constraint: Constraint; text: string }
  | { kind: "action"; action: Exclude<CoachAction, null>; text: string }
  | { kind: "done"; text: string }
  | { kind: "none" };

const ADAPT: { test: RegExp; constraint: Constraint; text: string }[] = [
  { test: /\b(short on time|busy|no time|\d+\s*min(ute)?s?)\b/i, constraint: "short_on_time", text: "Trimmed today to the essentials." },
  { test: /\b(sore|aching|stiff|hurts?)\b/i, constraint: "sore", text: "Swapped today for gentle mobility." },
  { test: /\b(tired|low energy|exhausted|sleepy|drained)\b/i, constraint: "low_energy", text: "Lightened today's sets. Easy tempo." },
  { test: /\b(missed|skipped)\b/i, constraint: "missed_yesterday", text: "Main work only today. No catch-up." },
];

/** Fast, deterministic understanding of common messages. Runs before (and without) any AI. */
export function understand(message: string): LocalIntent {
  const text = message.trim();
  if (!text) return { kind: "none" };
  // Questions deserve a real answer, not a shortcut.
  if (/\?\s*$/.test(text) || /^(what|how|why|should|can|could|is|are|do|does|which|when|where)\b/i.test(text)) {
    return { kind: "none" };
  }

  if (/\b(ate|had|eating|log|logged|breakfast|lunch|dinner|snack)\b/i.test(text)) {
    const items = parseFoodText(text);
    if (items.length) return { kind: "meal", estimate: estimateFromItems(items) };
  }

  for (const rule of ADAPT) {
    if (rule.test.test(text)) return { kind: "adapt", constraint: rule.constraint, text: rule.text };
  }

  if (/\b(done|finished|completed)\b.*\b(workout|training|session)\b|\bworkout done\b/i.test(text)) {
    return { kind: "done", text: "Logged. Nice work today." };
  }
  if (/\b(meal photo|take a (photo|picture)|open (the )?camera|scan (my )?(meal|food|plate))\b/i.test(text)) {
    return { kind: "action", action: "open_camera", text: "Opening the camera." };
  }
  if (/\b(count (my )?(squats|reps)|squat counter|track squats)\b/i.test(text)) {
    return { kind: "action", action: "open_squats", text: "Opening the rep counter." };
  }
  if (/\b(help me (relax|calm down|unwind|sleep)|start (recovery|my reset|the reset)|stressed|anxious|nidra|meditat\w*|breathing)\b/i.test(text)) {
    return { kind: "action", action: "open_recovery", text: "Let's slow down together." };
  }
  return { kind: "none" };
}

export function offlineReply(message: string) {
  if (/\b(hi|hello|hey|namaste)\b/i.test(message)) return "Hello. What would help most right now?";
  if (/\b(protein)\b/i.test(message)) return "Eggs, dal, yogurt, paneer, tofu and chicken are easy protein wins.";
  if (/\b(water|hydrat)/i.test(message)) return "Aim for a glass with each meal and one after training.";
  return "I can log meals (“I had dal and rice”), adjust training (“I'm sore”), or start a reset (“help me relax”).";
}
