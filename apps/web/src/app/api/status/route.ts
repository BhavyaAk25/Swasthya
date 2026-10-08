import { gemini, json } from "@/lib/server/gemini";
import type { AiStatus } from "@/lib/types";

export const dynamic = "force-dynamic";

// A key alone isn't enough: some networks block Google's API host. Check reachability, cached briefly.
let cache: { at: number; reachable: boolean } | null = null;
const TTL = 5 * 60 * 1000;

async function reachable() {
  if (cache && Date.now() - cache.at < TTL) return cache.reachable;
  let ok = false;
  try {
    await fetch("https://generativelanguage.googleapis.com/", { method: "HEAD", signal: AbortSignal.timeout(3000) });
    ok = true; // any HTTP response means the host is reachable
  } catch {
    ok = false;
  }
  cache = { at: Date.now(), reachable: ok };
  return ok;
}

export async function GET() {
  const ai = Boolean(gemini()) && (await reachable());
  return json<AiStatus>({ ai, live: ai });
}
