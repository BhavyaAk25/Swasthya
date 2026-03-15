import { z } from "zod";

import { apiError, apiOk } from "@/lib/server/api";
import { adaptWorkout } from "@/lib/server/store";

const schema = z.object({
  constraint: z.enum(["low_energy", "sore", "short_on_time", "missed_yesterday"]),
});

export async function POST(request: Request) {
  try {
    const json = await request.json();
    const payload = schema.parse(json);
    const state = await adaptWorkout(payload.constraint);
    return apiOk(state);
  } catch {
    return apiError("Unable to adapt workout.", 400);
  }
}
