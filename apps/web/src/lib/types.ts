export type Goal = "consistency" | "strength" | "recovery";
export type Split = "three-day" | "upper-lower" | "full-body";
export type Constraint = "low_energy" | "sore" | "short_on_time" | "missed_yesterday";
export type Confidence = "low" | "medium" | "high";
export type Tab = "today" | "nourish" | "move" | "restore";

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
  status: "planned" | "done" | "skipped";
  completed: string[]; // exercise ids
  adaptation?: Constraint;
  reps?: number;
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
}

export interface AppData {
  version: 2;
  profile: Profile | null;
  meals: Meal[];
  workouts: Record<string, WorkoutDay>;
  recovery: RecoveryLog[];
  messages: Message[];
  snoozedUntil?: string;
}

export interface AiStatus {
  ai: boolean;
  live: boolean;
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
  calories: number;
  calorieTarget: number;
  protein: number;
  proteinTarget: number;
}

export type CoachAction = "open_camera" | "open_squats" | "open_recovery" | null;

export interface CoachReply {
  text: string;
  action: CoachAction;
}

export interface LiveToken {
  token: string;
  model: string;
}
