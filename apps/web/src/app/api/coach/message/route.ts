import { z } from "zod";

import { apiError, apiOk } from "@/lib/server/api";
import { sendCoachMessage } from "@/lib/server/store";

const schema = z.object({
  message: z.string().min(1),
});

export async function POST(request: Request) {
  try {
    const json = await request.json();
    const payload = schema.parse(json);
    const data = await sendCoachMessage(payload.message);
    return apiOk(data);
  } catch (error) {
    return apiError(error instanceof Error ? error.message : "Unable to process coach message.", 400);
  }
}
