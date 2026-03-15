import { z } from "zod";

import { apiError, apiOk } from "@/lib/server/api";
import { logWorkout } from "@/lib/server/store";

const schema = z.object({
  status: z.enum(["planned", "done", "skipped", "rescheduled"]),
});

export async function POST(request: Request) {
  try {
    const json = await request.json();
    const payload = schema.parse(json);
    const state = await logWorkout(payload.status);
    return apiOk(state);
  } catch {
    return apiError("Unable to log workout.", 400);
  }
}
