import { z } from "zod";

import { apiError, apiOk } from "@/lib/server/api";
import { logMeal } from "@/lib/server/store";

const schema = z.object({
  clarification: z.string().default("Portion looks standard."),
});

export async function POST(request: Request) {
  try {
    const json = await request.json();
    const payload = schema.parse(json);
    const state = await logMeal(payload.clarification);
    return apiOk(state);
  } catch {
    return apiError("Unable to log meal.", 400);
  }
}
