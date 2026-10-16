import { z } from "zod";

import { askJson } from "@/lib/server/ai";
import { ACTIONS, coachContextSchema, contextBlock } from "@/lib/server/context";
import { fail, json, offline } from "@/lib/server/gemini";
import type { CoachNote } from "@/lib/types";

/** A short, personal suggestion for the Today page, built only from structured context. */
const body = z.object({ context: coachContextSchema, partOfDay: z.enum(["morning", "afternoon", "evening", "night"]) });

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
      user: `<context>\nPart of day: ${parsed.data.partOfDay}\n${contextBlock(parsed.data.context)}\n</context>`,
      jsonSchema,
      temperature: 0.7,
      maxTokens: 160,
    });
    const text = result.text.trim();
    return json<CoachNote>({ ...result, text: /[.!?]$/.test(text) ? text : `${text}.` });
  } catch (error) {
    if (error instanceof Error && error.message === "offline") return offline();
    return fail("AI request failed.", 502);
  }
}
