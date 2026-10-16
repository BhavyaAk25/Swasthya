import { z } from "zod";

import { createLiveToken, fail, gemini, json, LIVE_MODEL, offline } from "@/lib/server/gemini";
import type { LiveToken } from "@/lib/types";

const body = z.object({
  goal: z.enum(["consistency", "strength", "recovery"]).default("consistency"),
});

export async function POST(request: Request) {
  if (!gemini()) return offline();

  const parsed = body.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) return fail("Invalid request.");

  const systemInstruction = [
    "You are Swasthya, a calm live recovery coach. The user may tell you their name in their first message.",
    `Their goal is ${parsed.data.goal}.`,
    "Guide a short relaxing breath and body-scan session in a slow, warm voice.",
    "Keep each turn to one or two sentences and ask at most one question at a time.",
    "If they want to talk about meals or training, keep it brief and practical. No medical advice.",
  ].join(" ");

  try {
    const token = await createLiveToken(systemInstruction);
    return json<LiveToken>({ token, model: LIVE_MODEL });
  } catch {
    return fail("Live voice could not start. Try the guided session instead.", 502);
  }
}
