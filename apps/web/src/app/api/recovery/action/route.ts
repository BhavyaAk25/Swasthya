import { z } from "zod";

import { apiError, apiOk } from "@/lib/server/api";
import { recoveryAction } from "@/lib/server/store";

const schema = z.object({
  action: z.enum(["done", "snooze", "reschedule", "live"]),
});

export async function POST(request: Request) {
  try {
    const json = await request.json();
    const payload = schema.parse(json);
    const state = await recoveryAction(payload.action);
    return apiOk(state);
  } catch (error) {
    return apiError(error instanceof Error ? error.message : "Unable to update recovery state.", 400);
  }
}
