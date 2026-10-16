export type Goal = "consistency" | "strength" | "recovery";
export type Split = "three-day" | "upper-lower" | "full-body";
export type Constraint = "low_energy" | "sore" | "short_on_time" | "missed_yesterday";
export type Confidence = "low" | "medium" | "high";
export type Tab = "today" | "nourish" | "move" | "restore" | "progress";

export interface Profile {
  name: string;
  goal: Goal;
  split: Split;
  recoveryTime: string; // "HH:MM" local
  calorieTarget: number;
  proteinTarget: number;
  createdAt: string;
}

export interface Meal {
  id: string;
  at: string; // ISO
  date: string; // local YYYY-MM-DD
  name: string;
  items: string[];
  calories: number;
  protein: number;
  confidence: Confidence;
  source: "photo" | "text" | "quick";
  photo?: string; // small JPEG data URL
}

export interface Exercise {
  id: string;
  name: string;
  sets: string;
  squat?: boolean; // eligible for the camera rep counter
}

export interface Session {
  id: string;
  title: string;
  focus: string;
  minutes: number;
  exercises: Exercise[];
  rest?: boolean;
}

export interface WorkoutDay {
  date: string;
  status: "planned" | "done";
  completed: string[]; // exercise ids
  adaptation?: Constraint;
  reps?: number; // squats counted by the camera
  seconds?: number; // time spent in the guided player
  sets?: number; // sets completed in the guided player
}

export type Mood = 1 | 2 | 3 | 4 | 5;

export interface CheckIn {
  date: string;
  water: number; // glasses
  sleep?: number; // hours
  mood?: Mood;
}

export interface RecoveryLog {
  id: string;
  date: string;
  at: string;
  minutes: number;
  kind: "guided" | "live";
}

export interface Message {
  id: string;
  role: "coach" | "user";
  text: string;
  at: string;
  /** A tool the coach suggested; shown as a button under the reply. */
  action?: CoachAction;
}

export interface AppData {
  version: 2;
  profile: Profile | null;
  meals: Meal[];
  workouts: Record<string, WorkoutDay>;
  recovery: RecoveryLog[];
  messages: Message[];
  checkins?: Record<string, CheckIn>;
  snoozedUntil?: string;
}

export interface AiStatus {
  ai: boolean;
  live: boolean;
  provider?: "groq" | "gemini" | null;
}

export interface MealEstimate {
  name: string;
  items: string[];
  calories: number;
  protein: number;
  confidence: Confidence;
  note: string;
}

export interface CoachContext {
  name: string;
  goal: Goal;
  session: string;
  adaptation?: Constraint;
  workoutDone: boolean;
  movesDone: number;
  movesTotal: number;
  recovered: boolean;
  streak: number;
  calories: number;
  calorieTarget: number;
  protein: number;
  proteinTarget: number;
  sleep?: number;
  mood?: Mood;
  water?: number;
  /** The three days before today, oldest first. */
  recent: { calories: number; workout: boolean; rested: boolean; sleep?: number; mood?: Mood }[];
}

export type CoachAction = "open_camera" | "open_squats" | "open_recovery" | "open_workout" | null;

export interface CoachNote {
  text: string;
  action: CoachAction;
}

export interface CoachReply {
  text: string;
  action: CoachAction;
}

export interface LiveToken {
  token: string;
  model: string;
}
