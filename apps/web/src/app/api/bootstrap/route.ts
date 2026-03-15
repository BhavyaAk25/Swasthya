import { apiError, apiOk } from "@/lib/server/api";
import { getAppState } from "@/lib/server/store";

export async function GET() {
  try {
    const state = await getAppState();
    return apiOk(state);
  } catch {
    return apiError("Unable to load app state.");
  }
}
