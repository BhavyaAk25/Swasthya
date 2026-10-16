import { estimateFromItems, parseFoodText } from "@/lib/foods";
import type { CoachAction, Constraint, MealEstimate } from "@/lib/types";

type LocalIntent =
  | { kind: "meal"; estimate: MealEstimate }
  | { kind: "adapt"; constraint: Constraint; text: string }
  | { kind: "action"; action: Exclude<CoachAction, null>; text: string }
  | { kind: "done"; text: string }
  | { kind: "none" };

const ADAPT: { test: RegExp; constraint: Constraint; text: string }[] = [
  { test: /\b(short on time|no time|in a hurry|(only|just) (have |got )?\d+\s*min(ute)?s?|\d+\s*min(ute)?s? (only|today|max))\b/i, constraint: "short_on_time", text: "Trimmed today to the essentials." },
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

/** Button label for each tool the coach can suggest. */
export const ACTION_LABEL: Record<NonNullable<CoachAction>, string> = {
  open_workout: "Start session",
  open_recovery: "5 min reset",
  open_camera: "Log a meal",
  open_squats: "Count squats",
};

/** Short, general answers for when no AI is available. Never medical advice. */
const OFFLINE: [RegExp, string][] = [
  [/\b(hi|hello|hey|namaste)\b/i, "Hello. What would help most right now?"],
  [/\b(pain|injur|hurt|dizzy|chest|faint)/i, "Please stop and rest. For pain, injury or feeling unwell, check with a doctor or physio before training again."],
  [/\b(sleep|bed ?time|insomnia|wake up|nap)/i, "Most adults do best with 7–9 hours. Pick a bedtime you can keep every night, dim screens an hour before, and try the evening reset to wind down."],
  [/\b(stress|anxious|anxiety|overwhelm|calm)/i, "Try a few slow breaths: four in, six out. The 5-minute reset in Restore can help."],
  [/\b(protein)\b/i, "Eggs, dal, yogurt, paneer, tofu and chicken are easy protein wins. Spread them across meals."],
  [/\b(water|hydrat|drink)/i, "Aim for a glass with each meal and one after training. Use the check-in to track it."],
  [/\b(lose|weight|fat|calorie)/i, "Steady habits beat big cuts: protein at each meal, plenty of vegetables, and moving most days. Your targets are in Settings."],
  [/\b(motivat|lazy|can't be bothered|skip)/i, "Start with just one move. Five minutes still counts, and it keeps the habit alive."],
  [/\b(eat|meal|breakfast|lunch|dinner|snack)\b/i, "Tell me what you ate (\u201cI had dal and rice\u201d) and I'll log it, or use the camera to pick foods."],
];

export function offlineReply(message: string) {
  return (
    OFFLINE.find(([test]) => test.test(message))?.[1] ??
    "I'm in offline mode, so I can only help with the basics: log a meal (\u201cI had dal and rice\u201d), adjust training (\u201cI'm sore\u201d), or start a reset (\u201chelp me relax\u201d)."
  );
}
