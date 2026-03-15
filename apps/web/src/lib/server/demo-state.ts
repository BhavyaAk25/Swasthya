import { addMinutes, formatISO } from "date-fns";

import type {
  AppState,
  ChatKind,
  ChatMessage,
  CoachMemory,
  DailySummary,
  GoalTone,
  LiveSessionPayload,
  OnboardingInput,
  RecoverySession,
  UserProfile,
  WorkoutConstraint,
  WorkoutPlan,
  WorkoutSession,
  WorkoutStatus,
} from "@/lib/types";

function nowIso() {
  return new Date().toISOString();
}

function createMessage(role: ChatMessage["role"], kind: ChatKind, content: string): ChatMessage {
  return {
    id: `msg-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    role,
    kind,
    content,
    createdAt: nowIso(),
  };
}

function createSummary(): DailySummary {
  return {
    date: new Date().toISOString().slice(0, 10),
    caloriesEstimate: 0,
    proteinEstimate: 0,
    mealsLogged: 0,
    workoutStatus: "planned",
    recoveryStatus: "scheduled",
    adherenceScore: 84,
    coachNote: "Show me your meal, tell me how training feels, or start your recovery when you are ready.",
  };
}

function protocolCopyForTone(tone: GoalTone) {
  if (tone === "performance") {
    return {
      coachNote: "We keep decisions sharp: one meal logged, one clean workout adjustment, one recovery reset.",
      memory: "You respond best to direct coaching and concise choices.",
    };
  }

  if (tone === "recovery") {
    return {
      coachNote: "Keep the day light, calm, and easy to complete.",
      memory: "You want gentle momentum and minimal friction.",
    };
  }

  return {
    coachNote: "Keep the day simple: log a meal, adapt the workout if needed, and close with recovery.",
    memory: "You want a balanced coach: clear, calm, and useful.",
  };
}

function createWorkoutSession(
  id: string,
  label: string,
  title: string,
  focus: string,
  durationMin: number,
  status: WorkoutStatus,
  exercises: WorkoutSession["exercises"],
): WorkoutSession {
  return {
    id,
    label,
    title,
    durationMin,
    focus,
    status,
    protocol: "Keep the session clean and stop before quality drops.",
    exercises,
  };
}

function createPlan(workoutSplit: string): WorkoutPlan {
  return {
    splitName: workoutSplit,
    weekOf: new Date().toISOString().slice(0, 10),
    sessions: [
      createWorkoutSession("session-1", "Today", "Squat Session", "Lower body strength", 24, "planned", [
        { name: "Air squats", sets: "3 x 12", focus: "Depth and rhythm" },
        { name: "Split squats", sets: "3 x 10 / side", focus: "Single-leg stability" },
        { name: "Glute bridge", sets: "3 x 15", focus: "Hip drive" },
      ]),
      createWorkoutSession("session-2", "Tomorrow", "Upper Push", "Pressing volume", 28, "planned", [
        { name: "Push-ups", sets: "4 x 10", focus: "Controlled pressing" },
        { name: "Pike push-ups", sets: "3 x 8", focus: "Shoulders" },
        { name: "Plank", sets: "3 x 40s", focus: "Bracing" },
      ]),
      createWorkoutSession("session-3", "Wed", "Recovery Flow", "Mobility and breath", 16, "planned", [
        { name: "Hip opener flow", sets: "6 min", focus: "Hips" },
        { name: "Thoracic rotation", sets: "6 min", focus: "Spine" },
      ]),
    ],
  };
}

function createRecoverySession(recoveryTime: string): RecoverySession {
  const scheduledFor = addMinutes(new Date(), 20);

  return {
    id: "recovery-1",
    type: "yoga_nidra",
    scheduledFor: formatISO(scheduledFor),
    status: "scheduled",
    title: "Evening reset",
    description: `A short guided recovery drop scheduled for ${recoveryTime}.`,
  };
}

function createCoachMemory(tone: GoalTone): CoachMemory {
  const copy = protocolCopyForTone(tone);

  return {
    preferences: [
      "Short direct coaching",
      "Minimal friction actions",
      "Meal estimates, not hard macro lectures",
    ],
    adherenceTrend: "Momentum is building.",
    lastMealContext: "No meals logged yet.",
    lastSessionSummary: copy.memory,
  };
}

function createLiveSession(name: string): LiveSessionPayload {
  return {
    title: `${name}'s live recovery`,
    status: "idle",
    transcript: {
      user: [],
      coach: [],
    },
    source: "fallback",
    model: null,
    sessionId: null,
    error: null,
  };
}

function seedMessages(name: string): ChatMessage[] {
  return [
    createMessage("coach", "text", `Hi ${name}. Tell me what you ate, how training feels, or when you want recovery.`),
  ];
}

export function createInitialState(): AppState {
  return {
    onboardingCompleted: false,
    user: null,
    summary: createSummary(),
    mealLogs: [],
    currentMealDraft: null,
    workoutPlan: null,
    recoverySession: null,
    coachMemory: {
      preferences: [],
      adherenceTrend: "No history yet.",
      lastMealContext: "No meal context yet.",
      lastSessionSummary: "Complete setup to begin.",
    },
    liveSession: null,
    messages: [createMessage("coach", "text", "Set your name, goal, and recovery time. I will keep the rest simple.")],
  };
}

export function buildStateFromOnboarding(input: OnboardingInput): AppState {
  const user: UserProfile = {
    id: "demo-user",
    displayName: input.displayName,
    goal: input.goal,
    experienceLevel: "intermediate",
    workoutSplit: input.workoutSplit,
    trainingDays: input.trainingDays,
    proteinFocus: input.proteinFocus,
    recoveryTime: input.recoveryTime,
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    tone: input.tone,
  };

  const copy = protocolCopyForTone(input.tone);
  const summary = createSummary();
  summary.coachNote = copy.coachNote;

  return {
    onboardingCompleted: true,
    user,
    summary,
    mealLogs: [],
    currentMealDraft: null,
    workoutPlan: createPlan(input.workoutSplit),
    recoverySession: createRecoverySession(input.recoveryTime),
    coachMemory: createCoachMemory(input.tone),
    liveSession: createLiveSession(input.displayName),
    messages: seedMessages(input.displayName),
  };
}

export function adaptSession(session: WorkoutSession, constraint: WorkoutConstraint) {
  const adapted = { ...session, exercises: [...session.exercises] };

  if (constraint === "short_on_time") {
    adapted.durationMin = 16;
    adapted.adaptationNote = "Cut to air squats and split squats only.";
    adapted.protocol = "Keep the first two movements only and finish cleanly.";
  }

  if (constraint === "low_energy") {
    adapted.durationMin = 18;
    adapted.adaptationNote = "Reduced volume and kept tempo easy.";
    adapted.protocol = "Move slowly and stop while you still feel better than when you started.";
  }

  if (constraint === "sore") {
    adapted.durationMin = 14;
    adapted.title = "Mobility + Light Squats";
    adapted.focus = "Range of motion";
    adapted.adaptationNote = "Swapped intensity for mobility and lighter reps.";
    adapted.protocol = "Treat today as recovery and patterning.";
  }

  if (constraint === "missed_yesterday") {
    adapted.durationMin = 20;
    adapted.adaptationNote = "Rolled the priority squat work forward and trimmed everything else.";
    adapted.protocol = "Do the main work only. Do not chase make-up volume.";
  }

  adapted.adaptationReason = constraint;
  return adapted;
}

export function appendMessage(state: AppState, role: ChatMessage["role"], kind: ChatKind, content: string) {
  state.messages.push(createMessage(role, kind, content));
  return state;
}
