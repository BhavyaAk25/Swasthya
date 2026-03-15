import { GoogleGenAI, Modality } from "@google/genai";

import { apiError, apiOk } from "@/lib/server/api";
import { getConfiguredLiveModel } from "@/lib/server/gemini";
import { getAppState } from "@/lib/server/store";
import type { LiveBootstrapPayload } from "@/lib/types";

function getLiveClient() {
  if (process.env.GEMINI_API_KEY) {
    return new GoogleGenAI({
      apiKey: process.env.GEMINI_API_KEY,
      apiVersion: "v1alpha",
    });
  }

  return null;
}

export async function POST() {
  try {
    const ai = getLiveClient();

    if (!ai) {
      return apiError("Gemini Live requires GEMINI_API_KEY for this build.", 400);
    }

    const state = await getAppState();
    const user = state.user;
    const recovery = state.recoverySession;

    if (!user || !recovery) {
      return apiError("Complete setup before starting a live session.", 400);
    }

    const model = getConfiguredLiveModel();
    const systemInstruction = [
      `You are Swasthya, a premium live wellness coach for ${user.displayName}.`,
      `Tone: ${user.tone}.`,
      `Goal: ${user.goal}.`,
      `Today's context: ${state.summary.coachNote}`,
      `Last meal context: ${state.coachMemory.lastMealContext}`,
      `Last workout context: ${state.coachMemory.lastSessionSummary}`,
      "Keep responses short, natural, warm, and useful.",
      "Ask one question at a time.",
      "Act like a real live coach, not a scripted narrator.",
      "If the user sounds overwhelmed, simplify the plan and calm them down.",
    ].join(" ");
    const token = await ai.authTokens.create({
      config: {
        uses: 1,
        liveConnectConstraints: {
          model,
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

    if (!token.name) {
      return apiError("Gemini Live did not return a usable auth token.", 500);
    }

    const payload: LiveBootstrapPayload = {
      token: token.name,
      model,
      systemInstruction,
      initialPrompt: null,
    };

    return apiOk(payload);
  } catch (error) {
    return apiError(error instanceof Error ? error.message : "Unable to start Gemini Live.", 400);
  }
}
