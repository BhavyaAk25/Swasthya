import { z } from "zod";

import { apiError, apiOk } from "@/lib/server/api";
import { logTrackedWorkout } from "@/lib/server/store";

const schema = z.object({
  reps: z.number().min(1),
});

export async function POST(request: Request) {
  try {
    const json = await request.json();
    const payload = schema.parse(json);
    const state = await logTrackedWorkout(payload);
    return apiOk(state);
  } catch {
    return apiError("Unable to save tracked workout.", 400);
  }
}
