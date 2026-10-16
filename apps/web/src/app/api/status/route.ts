import { liveVoiceAvailable, providers } from "@/lib/server/ai";
import { json } from "@/lib/server/gemini";
import type { AiStatus } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function GET() {
  const [list, live] = await Promise.all([providers(), liveVoiceAvailable()]);
  return json<AiStatus>({ ai: list.length > 0, live, provider: list[0] ?? null });
}
