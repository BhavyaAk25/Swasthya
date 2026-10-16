import { GoogleGenAI, Modality } from "@google/genai";
import { NextResponse } from "next/server";
import { z } from "zod";

/**
 * Gemini is optional. With a free Google AI Studio key (no billing) in GEMINI_API_KEY the app
 * gets photo meal estimates, free-form coach replies and live voice. Without it every feature
 * falls back to on-device logic in the browser.
 */
const CORE_MODELS = (process.env.GEMINI_MODELS ?? "gemini-flash-latest,gemini-2.5-flash,gemini-2.5-flash-lite")
  .split(",")
  .map((m) => m.trim())
  .filter(Boolean);

export const LIVE_MODEL = process.env.GEMINI_LIVE_MODEL ?? "gemini-2.5-flash-native-audio-preview-12-2025";

let client: GoogleGenAI | null | undefined;

export function gemini() {
  if (client === undefined) {
    const apiKey = process.env.GEMINI_API_KEY?.trim();
    client = apiKey ? new GoogleGenAI({ apiKey }) : null;
  }
  return client;
}

export function json<T>(data: T, status = 200) {
  return NextResponse.json(data, { status });
}

export function offline() {
  return json({ offline: true, error: "AI is not configured." }, 503);
}

export function fail(message: string, status = 400) {
  return json({ error: message }, status);
}

/** Try each configured model in turn and return the first schema-valid JSON result. */
export async function generateJson<T>(
  schema: z.ZodType<T>,
  build: (model: string) => Parameters<GoogleGenAI["models"]["generateContent"]>[0],
): Promise<T> {
  const ai = gemini();
  if (!ai) throw new Error("offline");

  let lastError = "No model responded.";
  for (const model of CORE_MODELS) {
    try {
      const params = build(model);
      const res = await ai.models.generateContent({ ...params, config: { ...params.config, abortSignal: AbortSignal.timeout(20000) } });
      const raw = (res.text ?? "").replace(/^```(?:json)?\s*|\s*```$/g, "").trim();
      const parsed = schema.safeParse(JSON.parse(raw));
      if (parsed.success) return parsed.data;
      lastError = "Model returned an unexpected shape.";
      console.warn(`[gemini] ${model}: unexpected shape`, parsed.error.issues.slice(0, 3));
    } catch (error) {
      console.warn(`[gemini] ${model}:`, error instanceof Error ? error.message.slice(0, 300) : error);
      // Never forward provider error text verbatim; it can include request details.
      lastError = error instanceof Error && /quota|429|rate/i.test(error.message) ? "AI is busy. Try again shortly." : "AI request failed.";
    }
  }
  throw new Error(lastError);
}

export async function createLiveToken(systemInstruction: string) {
  const ai = process.env.GEMINI_API_KEY
    ? new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY, apiVersion: "v1alpha" })
    : null;
  if (!ai) throw new Error("offline");

  // Single-use, short-lived token locked to this model + instruction, so the real key never reaches the browser.
  const token = await ai.authTokens.create({
    config: {
      uses: 1,
      expireTime: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
      newSessionExpireTime: new Date(Date.now() + 2 * 60 * 1000).toISOString(),
      liveConnectConstraints: {
        model: LIVE_MODEL,
        config: {
          responseModalities: [Modality.AUDIO],
          systemInstruction,
          inputAudioTranscription: {},
          outputAudioTranscription: {},
        },
      },
      lockAdditionalFields: [],
    },
  });
  if (!token.name) throw new Error("No token returned.");
  return token.name;
}

/** Strip control characters and cap length for any user-provided text placed in a prompt. */
export function clean(value: string, max: number) {
  return value.replace(/[\u0000-\u001f\u007f]+/g, " ").slice(0, max).trim();
}
