export type GoalTone = "balanced" | "performance" | "recovery";

export type WorkoutConstraint =
  | "low_energy"
  | "sore"
  | "short_on_time"
  | "missed_yesterday";

export type WorkoutStatus = "planned" | "done" | "skipped" | "rescheduled";

export type RecoveryStatus = "scheduled" | "live" | "done" | "snoozed";

export type ChatRole = "coach" | "user" | "system";

export type ChatKind = "text" | "meal" | "workout" | "recovery";

export type CoachAction =
  | "open_meal_camera"
  | "open_workout_tracker"
  | "open_live_session"
  | null;

export interface UserProfile {
  id: string;
  displayName: string;
  goal: string;
  experienceLevel: "beginner" | "intermediate" | "advanced";
  workoutSplit: string;
  trainingDays: number;
  proteinFocus: string;
  recoveryTime: string;
  timezone: string;
  tone: GoalTone;
}

export interface DailySummary {
  date: string;
  caloriesEstimate: number;
  proteinEstimate: number;
  mealsLogged: number;
  workoutStatus: WorkoutStatus;
  recoveryStatus: RecoveryStatus;
  adherenceScore: number;
  coachNote: string;
}

export interface DailyLog {
  date: string;
  caloriesEstimate: number;
  proteinEstimate: number;
  mealsLogged: number;
}

export interface MealDraft {
  id: string;
  imageDataUrl: string | null;
  foods: string[];
  caloriesEstimate: number;
  proteinEstimate: number;
  confidence: "low" | "medium" | "high";
  followUpQuestion: string;
  quickAnswers: string[];
  protocolNote: string;
  source: "camera" | "text";
  model?: string | null;
}

export interface MealLog extends Omit<MealDraft, "followUpQuestion" | "quickAnswers"> {
  timestamp: string;
  clarification: string;
}

export interface WorkoutExercise {
  name: string;
  sets: string;
  focus: string;
}

export interface WorkoutSession {
  id: string;
  label: string;
  title: string;
  durationMin: number;
  focus: string;
  status: WorkoutStatus;
  exercises: WorkoutExercise[];
  protocol: string;
  adaptationReason?: WorkoutConstraint;
  adaptationNote?: string;
  trackedReps?: number;
}

export interface WorkoutPlan {
  splitName: string;
  weekOf: string;
  sessions: WorkoutSession[];
}

export interface RecoverySession {
  id: string;
  type: "yoga_nidra" | "recovery_reset";
  scheduledFor: string;
  status: RecoveryStatus;
  title: string;
  description: string;
  completedAt?: string;
  snoozedUntil?: string;
}

export interface LiveSessionPayload {
  title: string;
  status: "idle" | "connecting" | "connected" | "listening" | "speaking" | "ended" | "error";
  transcript: {
    user: string[];
    coach: string[];
  };
  source: "gemini-live" | "fallback";
  model?: string | null;
  sessionId?: string | null;
  error?: string | null;
}

export interface LiveBootstrapPayload {
  token: string;
  model: string;
  systemInstruction: string;
  initialPrompt?: string | null;
}

export interface ChatMessage {
  id: string;
  role: ChatRole;
  kind: ChatKind;
  content: string;
  createdAt: string;
}

export interface CoachMemory {
  preferences: string[];
  adherenceTrend: string;
  lastMealContext: string;
  lastSessionSummary: string;
}

export interface AppState {
  onboardingCompleted: boolean;
  user: UserProfile | null;
  summary: DailySummary;
  dailyLogs: DailyLog[];
  mealLogs: MealLog[];
  currentMealDraft: MealDraft | null;
  workoutPlan: WorkoutPlan | null;
  recoverySession: RecoverySession | null;
  coachMemory: CoachMemory;
  liveSession: LiveSessionPayload | null;
  messages: ChatMessage[];
}

export interface OnboardingInput {
  displayName: string;
  goal: string;
  workoutSplit: string;
  trainingDays: number;
  proteinFocus: string;
  recoveryTime: string;
  timezone?: string;
  tone: GoalTone;
}

export interface CoachReply {
  message: string;
  action: CoachAction;
}

export interface TrackedWorkoutPayload {
  reps: number;
}

export interface ApiResponse<T> {
  ok: boolean;
  data: T | null;
  error: string | null;
}
