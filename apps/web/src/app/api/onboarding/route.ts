import { z } from "zod";

import { apiError, apiOk } from "@/lib/server/api";
import { saveOnboarding } from "@/lib/server/store";

const onboardingSchema = z.object({
  displayName: z.string().min(1),
  goal: z.string().min(1),
  workoutSplit: z.string().min(1),
  trainingDays: z.number().min(2).max(6),
  proteinFocus: z.string().min(1),
  recoveryTime: z.string().regex(/^\d{2}:\d{2}$/),
  timezone: z.string().min(1).optional(),
  tone: z.enum(["balanced", "performance", "recovery"]),
});

export async function POST(request: Request) {
  try {
    const json = await request.json();
    const payload = onboardingSchema.parse(json);
    const state = await saveOnboarding(payload);
    return apiOk(state);
  } catch {
    return apiError("Unable to save onboarding.", 400);
  }
}
