import { apiError, apiOk } from "@/lib/server/api";
import { resetDemoState } from "@/lib/server/store";

export async function POST() {
  try {
    const state = await resetDemoState();
    return apiOk(state);
  } catch {
    return apiError("Unable to reset demo.");
  }
}
