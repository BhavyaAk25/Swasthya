import { z } from "zod";

import { clean } from "@/lib/server/gemini";
import type { CoachContext } from "@/lib/types";

const mood = z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4), z.literal(5)]);

/** Validates the coach context the browser sends (see coachContext in lib/store.ts). */
export const coachContextSchema = z.object({
  name: z.string().max(40),
  goal: z.enum(["consistency", "strength", "recovery"]),
  session: z.string().max(60),
  adaptation: z.enum(["low_energy", "sore", "short_on_time", "missed_yesterday"]).optional(),
  workoutDone: z.boolean(),
  movesDone: z.number().int().min(0).max(30),
  movesTotal: z.number().int().min(0).max(30),
  recovered: z.boolean(),
  streak: z.number().int().min(0).max(3650),
  calories: z.number().min(0).max(20000),
  calorieTarget: z.number().min(0).max(10000),
  protein: z.number().min(0).max(1000),
  proteinTarget: z.number().min(0).max(1000),
  water: z.number().int().min(0).max(16).optional(),
  sleep: z.number().min(0).max(14).optional(),
  mood: mood.optional(),
  recent: z
    .array(z.object({ calories: z.number().min(0).max(20000), workout: z.boolean(), rested: z.boolean(), sleep: z.number().min(0).max(14).optional(), mood: mood.optional() }))
    .max(7),
}) satisfies z.ZodType<CoachContext>;

const ADAPT: Record<string, string> = {
  low_energy: "lightened for low energy",
  sore: "swapped for mobility (sore)",
  short_on_time: "trimmed (short on time)",
  missed_yesterday: "main work only (missed yesterday)",
};

/** Plain-language summary for the prompt. Only the name is free text, and it is cleaned. */
export function contextBlock(c: z.infer<typeof coachContextSchema>) {
  const day = (r: z.infer<typeof coachContextSchema>["recent"][number], i: number) =>
    `${["3 days ago", "2 days ago", "yesterday"][i] ?? "earlier"}: ~${Math.round(r.calories)} kcal, ${r.workout ? "trained" : "no workout"}, ${r.rested ? "rested" : "no reset"}` +
    `${r.sleep !== undefined ? `, slept ${r.sleep} h` : ""}${r.mood !== undefined ? `, mood ${r.mood}/5` : ""}`;
  return [
    `Name: ${clean(c.name, 40)}`,
    `Goal: ${c.goal}`,
    `Today's session: ${clean(c.session, 60)}${c.adaptation ? ` (${ADAPT[c.adaptation]})` : ""}; ${c.workoutDone ? "done" : `${c.movesDone}/${c.movesTotal} moves done`}`,
    `Evening reset: ${c.recovered ? "done today" : "not yet"}`,
    `Streak: ${c.streak} active day${c.streak === 1 ? "" : "s"}`,
    `Eaten today: ~${Math.round(c.calories)} of ${c.calorieTarget} kcal, ${Math.round(c.protein)} of ${c.proteinTarget} g protein`,
    c.sleep !== undefined ? `Slept: ${c.sleep} h` : null,
    c.mood !== undefined ? `Mood: ${c.mood}/5` : null,
    c.water !== undefined ? `Water: ${c.water} glasses` : null,
    ...c.recent.map(day),
  ]
    .filter(Boolean)
    .join("\n");
}

export const ACTIONS = ["open_camera", "open_squats", "open_recovery", "open_workout"] as const;
