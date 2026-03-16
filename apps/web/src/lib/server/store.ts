import { addMinutes } from "date-fns";

import {
  adaptSession,
  appendMessage,
  buildStateFromOnboarding,
  createInitialState,
  getScheduledRecoveryDate,
} from "@/lib/server/demo-state";
import { isFirestoreEnabled, readFirestoreState, writeFirestoreState } from "@/lib/server/firestore";
import {
  analyzeMealWithGemini,
  createAdaptationNote,
  createCoachReplyWithGemini,
  getConfiguredLiveModel,
  parseMealFromText,
} from "@/lib/server/gemini";
import type {
  AppState,
  CoachAction,
  DailyLog,
  OnboardingInput,
  TrackedWorkoutPayload,
  WorkoutConstraint,
  WorkoutStatus,
} from "@/lib/types";

declare global {
  var __swasthyaState: AppState | undefined;
}

function getStateContainer() {
  if (!global.__swasthyaState) {
    global.__swasthyaState = createInitialState();
  }

  return global.__swasthyaState;
}

function ensureDailyLogs(state: AppState) {
  const existing = new Map<string, DailyLog>();

  for (const meal of state.mealLogs) {
    const date = meal.timestamp.slice(0, 10);
    const current = existing.get(date) ?? {
      date,
      caloriesEstimate: 0,
      proteinEstimate: 0,
      mealsLogged: 0,
    };

    current.caloriesEstimate += meal.caloriesEstimate;
    current.proteinEstimate += meal.proteinEstimate;
    current.mealsLogged += 1;
    existing.set(date, current);
  }

  const today = state.summary.date;
  const todayLog = existing.get(today) ?? {
    date: today,
    caloriesEstimate: state.summary.caloriesEstimate,
    proteinEstimate: state.summary.proteinEstimate,
    mealsLogged: state.summary.mealsLogged,
  };

  todayLog.caloriesEstimate = state.summary.caloriesEstimate;
  todayLog.proteinEstimate = state.summary.proteinEstimate;
  todayLog.mealsLogged = state.summary.mealsLogged;
  existing.set(today, todayLog);

  state.dailyLogs = Array.from(existing.values()).sort((left, right) => right.date.localeCompare(left.date));
}

function normalizeState(state: AppState) {
  if (!state.dailyLogs) {
    state.dailyLogs = [];
  }

  const today = new Date().toISOString().slice(0, 10);
  if (state.summary.date !== today) {
    const coachNote = state.summary.coachNote;
    const existing = (state.dailyLogs ?? []).find((log) => log.date === today);
    state.summary = {
      date: today,
      caloriesEstimate: existing?.caloriesEstimate ?? 0,
      proteinEstimate: existing?.proteinEstimate ?? 0,
      mealsLogged: existing?.mealsLogged ?? 0,
      workoutStatus: "planned",
      recoveryStatus: "scheduled",
      adherenceScore: state.summary.adherenceScore,
      coachNote,
    };
  }

  if (state.user && state.recoverySession && state.recoverySession.status === "scheduled") {
    state.recoverySession.scheduledFor = getScheduledRecoveryDate(
      state.user.recoveryTime,
      state.user.timezone,
    ).toISOString();
    state.recoverySession.description = `A short guided recovery drop scheduled for ${state.user.recoveryTime}.`;
  }

  ensureDailyLogs(state);
  return state;
}

async function readState() {
  if (isFirestoreEnabled()) {
    const state = await readFirestoreState();
    global.__swasthyaState = normalizeState(state);
    return global.__swasthyaState;
  }

  return normalizeState(getStateContainer());
}

async function writeState(state: AppState) {
  normalizeState(state);
  global.__swasthyaState = state;

  if (isFirestoreEnabled()) {
    try {
      await writeFirestoreState(state);
    } catch {
      return state;
    }
  }

  return state;
}

function getTodayWorkout(state: AppState) {
  return state.workoutPlan?.sessions[0] ?? null;
}

function inferIntent(message: string): CoachAction {
  const normalized = message.toLowerCase();

  if (normalized.includes("meal") || normalized.includes("food") || normalized.includes("camera")) {
    return "open_meal_camera";
  }

  if (normalized.includes("squat") || normalized.includes("track workout") || normalized.includes("count reps")) {
    return "open_workout_tracker";
  }

  if (normalized.includes("recovery") || normalized.includes("call") || normalized.includes("live")) {
    return "open_live_session";
  }

  return null;
}

function isMealTextIntent(message: string) {
  return /\b(i ate|i had|ate|had|logged|log)\b/i.test(message);
}

export async function getAppState() {
  return readState();
}

export async function saveOnboarding(input: OnboardingInput) {
  return writeState(buildStateFromOnboarding(input));
}

export async function analyzeMeal(imageDataUrl: string) {
  const state = await readState();
  const analysis = await analyzeMealWithGemini(imageDataUrl, state.user);

  state.currentMealDraft = {
    id: `meal-${Date.now()}`,
    imageDataUrl,
    source: "camera",
    ...analysis,
  };

  appendMessage(
    state,
    "coach",
    "meal",
    `${analysis.foods.join(", ")}. About ${analysis.caloriesEstimate} cal and ${analysis.proteinEstimate}g protein. ${analysis.followUpQuestion}`,
  );

  return writeState(state);
}

async function logTextMealFromMessage(message: string) {
  const state = await readState();
  const parsed = await parseMealFromText(message, state.user);

  if (!parsed) {
    return null;
  }

  state.mealLogs.unshift({
    id: `meal-${Date.now()}`,
    imageDataUrl: null,
    source: "text",
    timestamp: new Date().toISOString(),
    clarification: "Logged from chat.",
    ...parsed,
  });
  state.summary.caloriesEstimate += parsed.caloriesEstimate;
  state.summary.proteinEstimate += parsed.proteinEstimate;
  state.summary.mealsLogged += 1;
  ensureDailyLogs(state);
  state.coachMemory.lastMealContext = `${parsed.foods.join(", ")} logged from chat.`;
  appendMessage(
    state,
    "coach",
    "meal",
    `Logged ${parsed.foods.join(", ")}. Daily total is now ${state.summary.caloriesEstimate} cal and ${state.summary.proteinEstimate}g protein.`,
  );

  return writeState(state);
}

export async function logMeal(clarification: string) {
  const state = await readState();
  const draft = state.currentMealDraft;

  if (!draft) {
    return state;
  }

  state.mealLogs.unshift({
    ...draft,
    timestamp: new Date().toISOString(),
    clarification,
  });
  state.summary.caloriesEstimate += draft.caloriesEstimate;
  state.summary.proteinEstimate += draft.proteinEstimate;
  state.summary.mealsLogged += 1;
  ensureDailyLogs(state);
  state.coachMemory.lastMealContext = `${draft.foods.join(", ")} logged with ${draft.confidence} confidence.`;
  state.currentMealDraft = null;

  appendMessage(
    state,
    "coach",
    "meal",
    `Logged. You are at ${state.summary.proteinEstimate}g protein today.`,
  );

  return writeState(state);
}

export async function adaptWorkout(constraint: WorkoutConstraint) {
  const state = await readState();
  const session = getTodayWorkout(state);

  if (!session) {
    return state;
  }

  const adapted = adaptSession(session, constraint);
  adapted.adaptationNote = await createAdaptationNote(adapted, constraint);
  state.workoutPlan!.sessions[0] = adapted;
  state.coachMemory.lastSessionSummary = adapted.adaptationNote;

  appendMessage(state, "coach", "workout", adapted.adaptationNote);

  return writeState(state);
}

export async function logWorkout(status: WorkoutStatus) {
  const state = await readState();
  const session = getTodayWorkout(state);

  if (!session) {
    return state;
  }

  session.status = status;
  state.summary.workoutStatus = status;
  state.summary.adherenceScore =
    status === "done" ? Math.min(99, state.summary.adherenceScore + 6) : Math.max(61, state.summary.adherenceScore - 4);

  appendMessage(
    state,
    "coach",
    "workout",
    status === "done" ? "Workout logged. Nice. Keep the rest of the day light." : `Workout marked ${status}.`,
  );

  return writeState(state);
}

export async function logTrackedWorkout(payload: TrackedWorkoutPayload) {
  const state = await readState();
  const session = getTodayWorkout(state);

  if (session) {
    session.trackedReps = payload.reps;
    session.status = "done";
    state.summary.workoutStatus = "done";
    state.summary.adherenceScore = Math.min(100, state.summary.adherenceScore + 6);
  }

  appendMessage(state, "coach", "workout", `Tracked ${payload.reps} squat reps. Session logged.`);
  return writeState(state);
}

export async function recoveryAction(action: "done" | "snooze" | "reschedule" | "live") {
  const state = await readState();
  const recoverySession = state.recoverySession;

  if (!recoverySession || !state.user) {
    return state;
  }

  if (action === "live") {
    state.liveSession = {
      title: `${state.user.displayName}'s live recovery`,
      status: "connecting",
      transcript: {
        user: [],
        coach: [],
      },
      source: "gemini-live",
      model: getConfiguredLiveModel(),
      sessionId: null,
      error: null,
    };
    recoverySession.status = "live";
    state.summary.recoveryStatus = "live";
    appendMessage(state, "coach", "recovery", "Live session is opening.");
  }

  if (action === "done") {
    recoverySession.status = "done";
    recoverySession.completedAt = new Date().toISOString();
    state.summary.recoveryStatus = "done";
    state.summary.adherenceScore = Math.min(100, state.summary.adherenceScore + 4);
    appendMessage(state, "coach", "recovery", "Recovery complete. Good place to stop pushing for the day.");
  }

  if (action === "snooze") {
    recoverySession.status = "snoozed";
    recoverySession.snoozedUntil = addMinutes(new Date(), 20).toISOString();
    recoverySession.scheduledFor = recoverySession.snoozedUntil;
    state.summary.recoveryStatus = "snoozed";
    appendMessage(state, "coach", "recovery", "Recovery snoozed for 20 minutes.");
  }

  if (action === "reschedule") {
    recoverySession.status = "scheduled";
    recoverySession.scheduledFor = getScheduledRecoveryDate(
      state.user.recoveryTime,
      state.user.timezone,
      addMinutes(new Date(), 90),
    ).toISOString();
    state.summary.recoveryStatus = "scheduled";
    appendMessage(state, "coach", "recovery", "Recovery moved later.");
  }

  return writeState(state);
}

export async function sendCoachMessage(message: string) {
  const state = await readState();
  const normalized = message.trim();

  if (!normalized) {
    return { state, action: null as CoachAction };
  }

  appendMessage(state, "user", "text", normalized);
  await writeState(state);

  if (isMealTextIntent(normalized)) {
    const nextState = await logTextMealFromMessage(normalized);
    if (nextState) {
      return { state: nextState, action: null as CoachAction };
    }
  }

  const lowered = normalized.toLowerCase();
  if (lowered.includes("20 min") || lowered.includes("20 minutes") || lowered.includes("short on time")) {
    const nextState = await adaptWorkout("short_on_time");
    return { state: nextState, action: null as CoachAction };
  }

  if (lowered.includes("sore")) {
    const nextState = await adaptWorkout("sore");
    return { state: nextState, action: null as CoachAction };
  }

  if (lowered.includes("low energy") || lowered.includes("tired")) {
    const nextState = await adaptWorkout("low_energy");
    return { state: nextState, action: null as CoachAction };
  }

  if (lowered.includes("missed")) {
    const nextState = await adaptWorkout("missed_yesterday");
    return { state: nextState, action: null as CoachAction };
  }

  if (lowered.includes("done workout")) {
    const nextState = await logWorkout("done");
    return { state: nextState, action: null as CoachAction };
  }

  if (lowered.includes("start recovery") || lowered.includes("start live")) {
    const nextState = await recoveryAction("live");
    return { state: nextState, action: "open_live_session" as CoachAction };
  }

  if (lowered.includes("snooze")) {
    const nextState = await recoveryAction("snooze");
    return { state: nextState, action: null as CoachAction };
  }

  if (lowered.includes("reschedule") || lowered.includes("later")) {
    const nextState = await recoveryAction("reschedule");
    return { state: nextState, action: null as CoachAction };
  }

  const localIntent = inferIntent(normalized);
  const generated =
    state.user && (await createCoachReplyWithGemini(normalized, state.user, getTodayWorkout(state)));

  const action = generated?.action ?? localIntent;
  const reply =
    generated?.message ??
    (action === "open_meal_camera"
      ? "Open the camera and show me your meal."
      : action === "open_workout_tracker"
        ? "Open the squat tracker and I will count reps."
        : action === "open_live_session"
          ? "Start the live session and I will guide the reset."
          : "I can help with meals, workout adjustments, squat tracking, or recovery.");

  appendMessage(state, "coach", "text", reply);
  const nextState = await writeState(state);
  return { state: nextState, action };
}

export async function resetDemoState() {
  return writeState(createInitialState());
}
