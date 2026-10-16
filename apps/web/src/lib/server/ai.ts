import { z } from "zod";

import { gemini, generateJson as geminiJson } from "@/lib/server/gemini";

/**
 * Optional AI with two free providers, tried in order:
 *   1. Groq (GROQ_API_KEY): fast open models over an OpenAI-compatible API. Groq retires models
 *      often, so the model is picked from what the key can actually use (see groqModels).
 *   2. Gemini (GEMINI_API_KEY): Google AI Studio free tier.
 * Each is used only if its key is set and its host is reachable (some networks block one).
 * Every caller has an on-device fallback, so AI being unavailable is never an error for users.
 */

const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";
const GROQ_MODELS_URL = "https://api.groq.com/openai/v1/models";
const list = (v: string | undefined) => (v ?? "").split(",").map((m) => m.trim()).filter(Boolean);
// Preference order; anything the key cannot use is skipped. Overridable from .env.local.
const TEXT_PREFS = [...list(process.env.GROQ_MODELS), "openai/gpt-oss-120b", "qwen/qwen3.8-27b", "llama-3.3-70b-versatile", "openai/gpt-oss-20b"];
const VISION_PREFS = [...list(process.env.GROQ_VISION_MODEL), "qwen/qwen3.8-27b", "meta-llama/llama-4-scout-17b-16e-instruct", "meta-llama/llama-4-maverick-17b-128e-instruct"];

let available: { at: number; ids: Set<string> } | null = null;

/** Models this key can use right now (cached for an hour), in preference order. */
async function groqModels(key: string, vision: boolean) {
  if (!available || Date.now() - available.at > 60 * 60 * 1000) {
    try {
      const res = await fetch(GROQ_MODELS_URL, { headers: { Authorization: `Bearer ${key}` }, signal: AbortSignal.timeout(5000) });
      const body = (await res.json()) as { data?: { id: string; active?: boolean }[] };
      if (res.ok && body.data) available = { at: Date.now(), ids: new Set(body.data.filter((m) => m.active !== false).map((m) => m.id)) };
    } catch {
      /* Fall back to the preference list as-is. */
    }
  }
  const prefs = [...new Set(vision ? VISION_PREFS : TEXT_PREFS)];
  const usable = available ? prefs.filter((m) => available!.ids.has(m)) : prefs;
  return usable.length ? usable.slice(0, 2) : prefs.slice(0, 2);
}

type Provider = "groq" | "gemini";

const reach = new Map<Provider, { at: number; ok: boolean }>();
const TTL = 5 * 60 * 1000;

async function reachable(provider: Provider) {
  const hit = reach.get(provider);
  if (hit && Date.now() - hit.at < TTL) return hit.ok;
  const url = provider === "groq" ? "https://api.groq.com/" : "https://generativelanguage.googleapis.com/";
  let ok = false;
  try {
    await fetch(url, { method: "HEAD", signal: AbortSignal.timeout(3000) });
    ok = true; // any HTTP answer means the host is reachable
  } catch {
    ok = false;
  }
  reach.set(provider, { at: Date.now(), ok });
  return ok;
}

function groqKey() {
  return process.env.GROQ_API_KEY?.trim() || null;
}

/** Providers that are configured and reachable right now, in preference order. */
export async function providers(): Promise<Provider[]> {
  const out: Provider[] = [];
  if (groqKey() && (await reachable("groq"))) out.push("groq");
  if (gemini() && (await reachable("gemini"))) out.push("gemini");
  return out;
}

export async function liveVoiceAvailable() {
  return Boolean(gemini()) && (await reachable("gemini"));
}

export interface JsonRequest {
  /** Rules for the model. Never put user text here. */
  system: string;
  /** User-provided content, already cleaned and wrapped in tags. */
  user: string;
  /** JSON schema for Gemini's structured output (Groq uses JSON mode + zod validation). */
  jsonSchema: object;
  /** Optional image as a data URL (vision). */
  image?: { mimeType: string; base64: string };
  temperature?: number;
  maxTokens?: number;
}

async function groqJson<T>(schema: z.ZodType<T>, req: JsonRequest): Promise<T> {
  const key = groqKey();
  if (!key) throw new Error("offline");
  const models = await groqModels(key, Boolean(req.image));
  const content = req.image
    ? [
        { type: "text", text: req.user },
        { type: "image_url", image_url: { url: `data:${req.image.mimeType};base64,${req.image.base64}` } },
      ]
    : req.user;
  let last = "AI request failed.";
  for (const model of models) {
    try {
      const res = await fetch(GROQ_URL, {
        method: "POST",
        headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
        signal: AbortSignal.timeout(20000),
        body: JSON.stringify({
          model,
          temperature: req.temperature ?? 0.5,
          // Reasoning models spend tokens thinking before the JSON; leave room and keep effort low.
          max_tokens: Math.max(1024, (req.maxTokens ?? 400) * 3),
          ...(model.startsWith("openai/gpt-oss") ? { reasoning_effort: "low" } : {}),
          response_format: { type: "json_object" },
          messages: [
            { role: "system", content: `${req.system}\nRespond with a single JSON object matching this schema: ${JSON.stringify(req.jsonSchema)}` },
            { role: "user", content },
          ],
        }),
      });
      if (!res.ok) {
        console.warn(`[groq] ${model}: HTTP ${res.status}`);
        if (res.status === 404) available = null; // model retired: refresh the list next time
        last = res.status === 429 ? "AI is busy. Try again shortly." : "AI request failed.";
        continue;
      }
      const data = (await res.json()) as { choices?: { message?: { content?: string } }[] };
      // Some models wrap JSON in thinking tags or prose; keep only the outermost object.
      const raw = (data.choices?.[0]?.message?.content ?? "").replace(/<think>[\s\S]*?<\/think>/g, "");
      const json = raw.slice(raw.indexOf("{"), raw.lastIndexOf("}") + 1);
      const parsed = schema.safeParse(JSON.parse(json));
      if (parsed.success) return parsed.data;
      console.warn(`[groq] ${model}: unexpected shape`, parsed.error.issues.slice(0, 3));
      last = "Model returned an unexpected shape.";
    } catch (error) {
      console.warn(`[groq] ${model}:`, error instanceof Error ? error.message.slice(0, 200) : error);
    }
  }
  throw new Error(last);
}

/** Ask the first available provider for schema-valid JSON. Throws "offline" if none is available. */
export async function askJson<T>(schema: z.ZodType<T>, req: JsonRequest): Promise<T> {
  const list = await providers();
  if (!list.length) throw new Error("offline");
  let last: unknown = new Error("AI request failed.");
  for (const provider of list) {
    try {
      if (provider === "groq") return await groqJson(schema, req);
      return await geminiJson(schema, (model) => ({
        model,
        contents: req.image
          ? [{ role: "user", parts: [{ inlineData: { mimeType: req.image.mimeType, data: req.image.base64 } }, { text: req.user }] }]
          : req.user,
        config: {
          systemInstruction: req.system,
          responseMimeType: "application/json",
          responseJsonSchema: req.jsonSchema,
          temperature: req.temperature ?? 0.5,
          maxOutputTokens: req.maxTokens ?? 400,
        },
      }));
    } catch (error) {
      last = error;
    }
  }
  throw last instanceof Error ? last : new Error("AI request failed.");
}
