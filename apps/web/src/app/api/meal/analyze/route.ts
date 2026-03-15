import { z } from "zod";

import { apiError, apiOk } from "@/lib/server/api";
import { analyzeMeal } from "@/lib/server/store";

const schema = z.object({
  imageDataUrl: z.string().min(20),
});

export async function POST(request: Request) {
  try {
    const json = await request.json();
    const payload = schema.parse(json);
    const state = await analyzeMeal(payload.imageDataUrl);
    return apiOk(state);
  } catch (error) {
    return apiError(error instanceof Error ? error.message : "Unable to analyze this meal image right now.", 400);
  }
}
