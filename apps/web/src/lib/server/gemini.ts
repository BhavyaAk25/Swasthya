import { GoogleGenAI } from "@google/genai";
import { z } from "zod";

import type {
  CoachReply,
  GoalTone,
  MealDraft,
  UserProfile,
  WorkoutConstraint,
  WorkoutSession,
} from "@/lib/types";

const DEFAULT_CORE_MODELS = ["gemini-3.1-flash-lite", "gemini-3-flash", "gemini-2.5-flash"];
const DEFAULT_LIVE_MODELS = [
  "gemini-2.5-flash-native-audio-preview-12-2025",
  "gemini-2.5-flash-native-audio-dialog",
  "gemini-2.5-flash-live-preview",
  "gemini-2.5-flash",
];

const mealJsonSchema = {
  type: "object",
  properties: {
    foods: { type: "array", items: { type: "string" } },
    caloriesEstimate: { type: "number" },
    proteinEstimate: { type: "number" },
    confidence: { type: "string", enum: ["low", "medium", "high"] },
    followUpQuestion: { type: "string" },
    quickAnswers: { type: "array", items: { type: "string" } },
    protocolNote: { type: "string" },
  },
  required: [
    "foods",
    "caloriesEstimate",
    "proteinEstimate",
    "confidence",
    "followUpQuestion",
    "quickAnswers",
    "protocolNote",
  ],
};

const coachJsonSchema = {
  type: "object",
  properties: {
    message: { type: "string" },
    action: {
      anyOf: [
        { type: "string", enum: ["open_meal_camera", "open_workout_tracker", "open_live_session"] },
        { type: "null" },
      ],
    },
  },
  required: ["message", "action"],
};

const textMealJsonSchema = {
  type: "object",
  properties: {
    foods: { type: "array", items: { type: "string" } },
    caloriesEstimate: { type: "number" },
    proteinEstimate: { type: "number" },
    confidence: { type: "string", enum: ["low", "medium", "high"] },
    protocolNote: { type: "string" },
  },
  required: ["foods", "caloriesEstimate", "proteinEstimate", "confidence", "protocolNote"],
};

const mealSchema = z.object({
  foods: z.array(z.string()).min(1),
  caloriesEstimate: z.number(),
  proteinEstimate: z.number(),
  confidence: z.enum(["low", "medium", "high"]),
  followUpQuestion: z.string(),
  quickAnswers: z.array(z.string()).min(1),
  protocolNote: z.string(),
});

const coachSchema = z.object({
  message: z.string(),
  action: z.enum(["open_meal_camera", "open_workout_tracker", "open_live_session"]).nullable(),
});

const textMealSchema = z.object({
  foods: z.array(z.string()).min(1),
  caloriesEstimate: z.number(),
  proteinEstimate: z.number(),
  confidence: z.enum(["low", "medium", "high"]),
  protocolNote: z.string(),
});

type ModelTextResult = {
  text: string;
  model: string;
};

type MealResult = Pick<
  MealDraft,
  "foods" | "caloriesEstimate" | "proteinEstimate" | "confidence" | "followUpQuestion" | "quickAnswers" | "protocolNote" | "model"
>;

type TextMealResult = Pick<
  MealDraft,
  "foods" | "caloriesEstimate" | "proteinEstimate" | "confidence" | "protocolNote" | "model"
>;

type FoodUnitEstimate = {
  canonical: string;
  caloriesPerUnit: number;
  proteinPerUnit: number;
  unitLabel: string;
};

const foodUnits: Record<string, FoodUnitEstimate> = {
  apple: { canonical: "apple", caloriesPerUnit: 95, proteinPerUnit: 0.5, unitLabel: "apple" },
  apples: { canonical: "apple", caloriesPerUnit: 95, proteinPerUnit: 0.5, unitLabel: "apple" },
  banana: { canonical: "banana", caloriesPerUnit: 105, proteinPerUnit: 1.3, unitLabel: "banana" },
  bananas: { canonical: "banana", caloriesPerUnit: 105, proteinPerUnit: 1.3, unitLabel: "banana" },
  egg: { canonical: "egg", caloriesPerUnit: 78, proteinPerUnit: 6.3, unitLabel: "egg" },
  eggs: { canonical: "egg", caloriesPerUnit: 78, proteinPerUnit: 6.3, unitLabel: "egg" },
  yogurt: { canonical: "yogurt cup", caloriesPerUnit: 150, proteinPerUnit: 15, unitLabel: "cup" },
  rice: { canonical: "rice bowl", caloriesPerUnit: 205, proteinPerUnit: 4.3, unitLabel: "cup" },
  oats: { canonical: "oats bowl", caloriesPerUnit: 150, proteinPerUnit: 5, unitLabel: "serving" },
  chicken: { canonical: "chicken serving", caloriesPerUnit: 220, proteinPerUnit: 38, unitLabel: "serving" },
  "chicken breast": { canonical: "chicken breast", caloriesPerUnit: 220, proteinPerUnit: 38, unitLabel: "serving" },
  "protein shake": { canonical: "protein shake", caloriesPerUnit: 160, proteinPerUnit: 30, unitLabel: "shake" },
};

function getClient() {
  if (process.env.GEMINI_API_KEY) {
    return new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  }

  if (
    process.env.GOOGLE_GENAI_USE_VERTEXAI === "true" &&
    process.env.GOOGLE_CLOUD_PROJECT &&
    process.env.GOOGLE_CLOUD_LOCATION
  ) {
    return new GoogleGenAI({
      vertexai: true,
      project: process.env.GOOGLE_CLOUD_PROJECT,
      location: process.env.GOOGLE_CLOUD_LOCATION,
    });
  }

  return null;
}

function getModelList(kind: "core" | "live") {
  const envValue = kind === "core" ? process.env.GEMINI_CORE_MODELS : process.env.GEMINI_LIVE_MODELS;
  const fallback = kind === "core" ? DEFAULT_CORE_MODELS : DEFAULT_LIVE_MODELS;

  if (!envValue) {
    return fallback;
  }

  const models = envValue
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);

  return models.length ? models : fallback;
}

export function getConfiguredLiveModel() {
  return getModelList("live")[0] ?? DEFAULT_LIVE_MODELS[0];
}

function stripDataUrlPrefix(value: string) {
  return value.includes(",") ? value.split(",")[1] : value;
}

function getDataUrlMimeType(value: string) {
  const match = value.match(/^data:([^;,]+)[;,]/i);
  return match?.[1] ?? "image/jpeg";
}

function safeParseJson<T>(raw: string | undefined, schema: z.ZodSchema<T>) {
  if (!raw) {
    return null;
  }

  const cleaned = raw.replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/\s*```$/, "").trim();

  try {
    return schema.parse(JSON.parse(cleaned));
  } catch {
    return null;
  }
}

function cleanGeminiError(error: unknown) {
  if (!(error instanceof Error)) {
    return "Gemini request failed.";
  }

  return error.message
    .replace(/api[_ -]?key[^.]*\./gi, "API key issue.")
    .replace(/\s+/g, " ")
    .trim();
}

async function generateWithFallback(
  kind: "core" | "live",
  paramsFactory: (model: string) => Parameters<GoogleGenAI["models"]["generateContent"]>[0],
): Promise<ModelTextResult> {
  const ai = getClient();

  if (!ai) {
    throw new Error("Gemini is not configured. Add GEMINI_API_KEY or Vertex AI settings first.");
  }

  const models = getModelList(kind);
  const failures: string[] = [];

  for (const model of models) {
    try {
      const response = await ai.models.generateContent(paramsFactory(model));
      if (!response.text?.trim()) {
        failures.push(`${model}: empty response`);
        continue;
      }

      return {
        text: response.text,
        model,
      };
    } catch (error) {
      failures.push(`${model}: ${cleanGeminiError(error)}`);
    }
  }

  throw new Error(`Gemini ${kind} request failed. ${failures.join(" | ")}`);
}

function inferTone(goalTone: GoalTone) {
  return goalTone === "performance"
    ? "direct and performance-minded"
    : goalTone === "recovery"
      ? "calm and restorative"
      : "balanced, calm, and concise";
}

function pluralize(word: string, count: number) {
  return count === 1 ? word : `${word}s`;
}

function heuristicMealFromText(message: string): TextMealResult | null {
  const normalized = message.toLowerCase().replace(/[.,!?]/g, " ");
  const match = normalized.match(
    /\b(?:i ate|i had|ate|had|logged|log)\s+(?:(\d+(?:\.\d+)?)\s+)?([a-z]+(?:\s+[a-z]+){0,3})\b/,
  );

  if (!match) {
    return null;
  }

  const count = Number(match[1] ?? "1");
  const food = match[2].trim();
  const estimate = foodUnits[food];

  if (!Number.isFinite(count) || count <= 0) {
    return null;
  }

  if (!estimate) {
    return {
      foods: [`${count} ${food}`.replace(/\s+/g, " ").trim()],
      caloriesEstimate: Math.round(count * 280),
      proteinEstimate: Math.round(count * 12),
      confidence: "low",
      protocolNote: "Logged from text with a rough fallback estimate. Ask me to refine it if the portion was unusual.",
      model: "heuristic-generic-parser",
    };
  }

  const unitPart = estimate.unitLabel === estimate.canonical ? "" : `${pluralize(estimate.unitLabel, count)} `;
  const foodLabel = pluralize(estimate.canonical, count);
  const foods = [`${count} ${unitPart}${foodLabel}`].map((value) => value.replace(/\s+/g, " ").trim());

  return {
    foods,
    caloriesEstimate: Math.round(estimate.caloriesPerUnit * count),
    proteinEstimate: Math.round(estimate.proteinPerUnit * count * 10) / 10,
    confidence: "medium",
    protocolNote: `Logged from text. If the portion was unusual, tell me and I will correct it.`,
    model: "heuristic-text-parser",
  };
}

export async function analyzeMealWithGemini(
  imageDataUrl: string,
  user: UserProfile | null,
): Promise<MealResult> {
  const result = await generateWithFallback("core", (model) => ({
    model,
    contents: [
      {
        inlineData: {
          mimeType: getDataUrlMimeType(imageDataUrl),
          data: stripDataUrlPrefix(imageDataUrl),
        },
      },
      `You are Swasthya, a concise nutrition coach.
Analyze a single meal photo for ${user?.displayName ?? "the user"}.
Rules:
- Describe only what is visually present.
- If this is a single fruit or single packaged item, say exactly that.
- Do not invent bowls, plates, side dishes, or garnishes that are not visible.
- Keep the answer minimal and useful.
- If the image is ambiguous, say so in confidence and ask one short follow-up.
Return JSON only with:
- foods
- caloriesEstimate
- proteinEstimate
- confidence
- followUpQuestion
- quickAnswers
- protocolNote`,
    ],
    config: {
      responseMimeType: "application/json",
      responseJsonSchema: mealJsonSchema,
    },
  }));

  const parsed = safeParseJson(result.text, mealSchema);

  if (!parsed) {
    throw new Error(`Gemini returned meal output that could not be parsed from ${result.model}.`);
  }

  return {
    ...parsed,
    model: result.model,
  };
}

export async function parseMealFromText(
  message: string,
  user: UserProfile | null,
): Promise<TextMealResult | null> {
  const normalized = message.toLowerCase();
  if (!/\b(i ate|i had|ate|had|logged|log)\b/.test(normalized)) {
    return null;
  }

  try {
    const result = await generateWithFallback("core", (model) => ({
      model,
      contents: `Turn this user message into one concise logged meal estimate.
Message: ${message}
User: ${user?.displayName ?? "the user"}
Rules:
- Only log foods explicitly mentioned.
- Do not invent side dishes.
- If quantity is given, respect it.
- Keep estimates conservative.
Return JSON only with foods, caloriesEstimate, proteinEstimate, confidence, protocolNote.`,
      config: {
        responseMimeType: "application/json",
        responseJsonSchema: textMealJsonSchema,
      },
    }));

    const parsed = safeParseJson(result.text, textMealSchema);
    if (parsed) {
      return {
        ...parsed,
        model: result.model,
      };
    }
  } catch {
    // Fall through to deterministic parsing when Gemini is unavailable.
  }

  const heuristic = heuristicMealFromText(message);
  if (heuristic) {
    return heuristic;
  }

  return null;
}

export async function createAdaptationNote(
  session: WorkoutSession,
  constraint: WorkoutConstraint,
): Promise<string> {
  const fallback: Record<WorkoutConstraint, string> = {
    low_energy: "Reduce the volume, keep the squats clean, and leave with energy still in the tank.",
    sore: "Switch today into mobility and lighter squat practice instead of pushing intensity.",
    short_on_time: "Keep only the squat work and one accessory so the session fits inside 20 minutes.",
    missed_yesterday: "Roll the main squat work forward and skip the urge to make up everything else.",
  };

  try {
    const result = await generateWithFallback("core", (model) => ({
      model,
      contents: `Rewrite this workout adjustment in one sentence.
Workout: ${session.title}
Focus: ${session.focus}
Constraint: ${constraint}
Keep it concise and practical.`,
    }));

    return result.text.trim() || fallback[constraint];
  } catch {
    return fallback[constraint];
  }
}

export async function createCoachReplyWithGemini(
  message: string,
  user: UserProfile,
  workout: WorkoutSession | null,
): Promise<CoachReply | null> {
  const result = await generateWithFallback("core", (model) => ({
    model,
    contents: `You are Swasthya, a concise wellness coach.
User message: ${message}
User goal: ${user.goal}
Coach tone: ${inferTone(user.tone)}
Today's workout: ${workout?.title ?? "none"}
Return JSON only with:
- message: one short helpful reply
- action: one of open_meal_camera, open_workout_tracker, open_live_session, or null
Keep it natural, brief, and not scripted.`,
    config: {
      responseMimeType: "application/json",
      responseJsonSchema: coachJsonSchema,
    },
  }));

  return safeParseJson(result.text, coachSchema);
}
