import { z } from "zod";

import { askJson } from "@/lib/server/ai";
import { ACTIONS, coachContextSchema, contextBlock } from "@/lib/server/context";
import { fail, json, offline } from "@/lib/server/gemini";
import type { CoachNote } from "@/lib/types";

/** A short, personal suggestion for the Today page, built only from structured context. */
const body = z.object({
  context: coachContextSchema,
  partOfDay: z.enum(["morning", "afternoon", "evening", "night"]),
  firstDay: z.boolean().default(false),
});

/** What each part of the day may suggest. Late at night: rest only, never food or training. */
const ALLOWED: Record<z.infer<typeof body>["partOfDay"], readonly (string | null)[]> = {
  morning: [...ACTIONS, null],
  afternoon: [...ACTIONS, null],
  evening: ["open_recovery", "open_workout", "open_camera", null],
  night: ["open_recovery", null],
};

const RULES: Record<z.infer<typeof body>["partOfDay"], string> = {
  morning: "It is morning: a good time for today's session, a protein-rich breakfast or the check-in.",
  afternoon: "It is afternoon: suggest the session if it is not done, or a balanced meal.",
  evening: "It is evening: prefer winding down (open_recovery). Suggest the session only if it is untouched and short; never suggest a big meal.",
  night: "It is late at night: encourage rest and sleep only. Never suggest eating, training or squats. Use open_recovery or null.",
};

const NIGHT_FALLBACK: CoachNote = { text: "It's late. A slow reset now will help you sleep well.", action: "open_recovery" };

const note = z.object({
  text: z.string().min(1).max(200),
  action: z.enum(ACTIONS).nullable(),
});

const jsonSchema = {
  type: "object",
  properties: {
    text: { type: "string" },
    action: { anyOf: [{ type: "string", enum: [...ACTIONS] }, { type: "null" }] },
  },
  required: ["text", "action"],
};

const SYSTEM = `You are Swasthya, a calm wellness coach writing one short note for the user's Today page.
Write one or two sentences (max 160 characters), warm and specific to the <context>: today's check-in,
session, food so far, streak and the last few days. Suggest the single most helpful next step for this
part of the day. Only state facts that are in the context (e.g. 0 moves done means not started). No medical advice, no guilt, no exclamation marks, no emoji.
Set action only if the note suggests exactly that tool: open_workout (today's session), open_recovery
(a relaxation reset), open_camera (log a meal), open_squats (camera squat counter). Otherwise null.
End with a full stop.`;

export async function POST(request: Request) {
  const parsed = body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return fail("Invalid request.");
  try {
    const result = await askJson(note, {
      system: SYSTEM,
      user: `<rules>\n${RULES[parsed.data.partOfDay]}${parsed.data.firstDay ? "\nThis is the user's first day with Swasthya: welcome them warmly by name and suggest one easy first step." : ""}\n</rules>\n<context>\nPart of day: ${parsed.data.partOfDay}\n${contextBlock(parsed.data.context)}\n</context>`,
      jsonSchema,
      temperature: 0.7,
      maxTokens: 160,
    });
    // Enforce the time-of-day policy even if the model ignores it.
    if (!ALLOWED[parsed.data.partOfDay].includes(result.action)) {
      return json<CoachNote>(parsed.data.partOfDay === "night" ? NIGHT_FALLBACK : { ...result, action: null });
    }
    if (parsed.data.partOfDay === "night" && /\b(eat|snack|meal|food|workout|train|session|squat)/i.test(result.text)) {
      return json<CoachNote>(NIGHT_FALLBACK);
    }
    const text = result.text.trim();
    return json<CoachNote>({ ...result, text: /[.!?]$/.test(text) ? text : `${text}.` });
  } catch (error) {
    if (error instanceof Error && error.message === "offline") return offline();
    return fail("AI request failed.", 502);
  }
}
