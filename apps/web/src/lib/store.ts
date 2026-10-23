"use client";

import { useSyncExternalStore } from "react";

import { adapt, GOALS, sessionFor, SPLITS } from "@/lib/plan";
import type { AppData, CheckIn, CoachAction, CoachContext, Constraint, Meal, Message, Profile, WorkoutDay } from "@/lib/types";
import { addDays, dateKey, uid } from "@/lib/utils";

const KEY = "swasthya:v2";
const MAX_MESSAGES = 60;
const MAX_PHOTOS = 24;

const empty = (): AppData => ({
  version: 2,
  profile: null,
  meals: [],
  workouts: {},
  recovery: [],
  messages: [],
  checkins: {},
});

let data: AppData | null = null; // null until hydrated on the client
const listeners = new Set<() => void>();

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);
const list = <T,>(v: unknown, ok: (x: unknown) => boolean): T[] => (Array.isArray(v) ? (v.filter(ok) as T[]) : []);

/** Read saved data defensively: a damaged field falls back on its own instead of crashing the app. */
function load(): AppData {
  try {
    const raw = window.localStorage.getItem(KEY);
    return (raw && sanitize(JSON.parse(raw))) || empty();
  } catch {
    return empty();
  }
}

/** Validate stored or imported data field by field. Returns null when it isn't Swasthya data. */
function sanitize(p: unknown): AppData | null {
  if (!isObj(p) || p.version !== 2) return null;
  const pr = isObj(p.profile) ? p.profile : null;
  const valid =
    pr && typeof pr.name === "string" && SPLITS.some((x) => x.id === pr.split) && GOALS.some((x) => x.id === pr.goal) && typeof pr.recoveryTime === "string";
  const profile = valid ? (pr as unknown as Profile) : null;
  const workouts: AppData["workouts"] = {};
  if (isObj(p.workouts)) {
    for (const [k, v] of Object.entries(p.workouts)) {
      if (isObj(v)) workouts[k] = { ...(v as unknown as WorkoutDay), completed: Array.isArray(v.completed) ? (v.completed as string[]) : [] };
    }
  }
  return {
    version: 2,
    profile,
    meals: list<Meal>(p.meals, (m) => isObj(m) && typeof m.date === "string" && typeof m.calories === "number").map((m) =>
      // Only small inline images are allowed as meal photos.
      m.photo && !(typeof m.photo === "string" && m.photo.startsWith("data:image/")) ? { ...m, photo: undefined } : m,
    ),
    workouts,
    recovery: list(p.recovery, (r) => isObj(r) && typeof r.date === "string" && typeof r.minutes === "number"),
    messages: list(p.messages, (m) => isObj(m) && typeof m.text === "string"),
    checkins: isObj(p.checkins) ? (p.checkins as AppData["checkins"]) : {},
    snoozedUntil: typeof p.snoozedUntil === "string" ? p.snoozedUntil : undefined,
  };
}

function persist(next: AppData) {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    // Storage full: drop old photos and try once more.
    try {
      const slim = { ...next, meals: next.meals.map((m, i) => (i < 6 ? m : { ...m, photo: undefined })) };
      window.localStorage.setItem(KEY, JSON.stringify(slim));
    } catch {
      // Private mode or blocked storage: keep working in memory.
    }
  }
}

function set(updater: (current: AppData) => AppData) {
  const next = updater(data ?? load());
  // Keep storage bounded.
  next.messages = next.messages.slice(-MAX_MESSAGES);
  let photos = 0;
  next.meals = next.meals.map((m) => (m.photo && ++photos > MAX_PHOTOS ? { ...m, photo: undefined } : m));
  data = next;
  persist(next);
  listeners.forEach((l) => l());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  if (data === null && typeof window !== "undefined") {
    data = load();
    queueMicrotask(() => listener());
  }
  return () => listeners.delete(listener);
}

export function useData(): AppData | null {
  return useSyncExternalStore(
    subscribe,
    () => data,
    () => null,
  );
}

/* ---------- selectors ---------- */

export function todayOf(d: AppData, date = new Date()) {
  const key = dateKey(date);
  const day: WorkoutDay = d.workouts[key] ?? { date: key, status: "planned", completed: [] };
  const base = d.profile ? sessionFor(d.profile.split, date) : null;
  const totals = totalsFor(d, key);
  return {
    key,
    meals: d.meals.filter((m) => m.date === key),
    calories: totals.calories,
    protein: totals.protein,
    day,
    session: base ? adapt(base, day.adaptation) : null,
    recovered: totals.recovered,
    recoveryMinutes: totals.recoveryMinutes,
  };
}

export function checkInFor(d: AppData, key = dateKey()): CheckIn {
  return d.checkins?.[key] ?? { date: key, water: 0 };
}

export function totalsFor(d: AppData, key: string) {
  const meals = d.meals.filter((m) => m.date === key);
  return {
    calories: meals.reduce((s, m) => s + m.calories, 0),
    protein: meals.reduce((s, m) => s + m.protein, 0),
    workout: d.workouts[key]?.status === "done",
    recovered: d.recovery.some((r) => r.date === key),
    recoveryMinutes: d.recovery.filter((r) => r.date === key).reduce((s, r) => s + r.minutes, 0),
    checkin: d.checkins?.[key],
  };
}

/** Consecutive days (ending today or yesterday) with any of: meal, workout, recovery. */
export function streak(d: AppData) {
  let count = 0;
  const cursor = new Date();
  const active = (k: string) => {
    const t = totalsFor(d, k);
    return t.calories > 0 || t.workout || t.recovered;
  };
  if (!active(dateKey(cursor))) cursor.setDate(cursor.getDate() - 1);
  while (active(dateKey(cursor)) && count < 365) {
    count += 1;
    cursor.setDate(cursor.getDate() - 1);
  }
  return count;
}

/** Everything the AI coach may know about today and the last few days (no free text). */
/** Distinct meals eaten recently (most recent first), for one-tap relogging. */
export function recentMeals(d: AppData, limit = 6): Meal[] {
  const seen = new Set<string>();
  const out: Meal[] = [];
  for (const m of [...d.meals].sort((a, b) => b.at.localeCompare(a.at))) {
    const key = m.name.trim().toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(m);
    if (out.length >= limit) break;
  }
  return out;
}

export function coachContext(d: AppData): CoachContext | null {
  const p = d.profile;
  if (!p) return null;
  const t = todayOf(d);
  const c = checkInFor(d, t.key);
  const session = t.session;
  const ids = new Set(session?.exercises.map((e) => e.id) ?? []);
  const recent = [3, 2, 1].map((back) => {
    const key = dateKey(addDays(new Date(), -back));
    const x = totalsFor(d, key);
    return { calories: x.calories, workout: x.workout, rested: x.recovered, sleep: x.checkin?.sleep, mood: x.checkin?.mood };
  });
  return {
    name: p.name,
    goal: p.goal,
    session: session?.title ?? "Rest",
    adaptation: t.day.adaptation,
    workoutDone: t.day.status === "done",
    movesDone: t.day.completed.filter((id) => ids.has(id)).length,
    movesTotal: ids.size,
    recovered: t.recovered,
    streak: streak(d),
    calories: t.calories,
    calorieTarget: p.calorieTarget,
    protein: t.protein,
    proteinTarget: p.proteinTarget,
    water: c.water,
    sleep: c.sleep,
    mood: c.mood,
    recent,
  };
}

/* ---------- actions ---------- */

function say(role: Message["role"], text: string, action?: CoachAction): Message {
  return { id: uid("m"), role, text, at: new Date().toISOString(), ...(action ? { action } : {}) };
}

function updateDay(d: AppData, fn: (day: WorkoutDay) => WorkoutDay): AppData {
  const key = dateKey();
  const day = d.workouts[key] ?? { date: key, status: "planned", completed: [] };
  return { ...d, workouts: { ...d.workouts, [key]: fn(day) } };
}

export const actions = {
  /** Run a change and return a function that puts everything back exactly as it was (for Undo). */
  withUndo(change: () => void) {
    const before = data ?? load();
    change();
    return () => set(() => before);
  },

  saveProfile(profile: Profile) {
    set((d) => ({
      ...d,
      profile,
      messages: d.messages.length ? d.messages : [say("coach", `Hi ${profile.name}. Tell me what you ate or how you feel today.`)],
    }));
  },

  addMeal(meal: Omit<Meal, "id" | "at" | "date">) {
    set((d) => ({
      ...d,
      meals: [{ ...meal, id: uid("meal"), at: new Date().toISOString(), date: dateKey() }, ...d.meals],
    }));
  },

  /** Rescale a logged meal to a new portion (½, 1, 1½, 2 ×) from its original estimate. */
  setPortion(id: string, portion: number) {
    const p = Math.min(3, Math.max(0.25, portion));
    set((d) => ({
      ...d,
      meals: d.meals.map((m) => {
        if (m.id !== id) return m;
        const was = m.portion ?? 1;
        return { ...m, portion: p, calories: Math.round((m.calories / was) * p), protein: Math.round((m.protein / was) * p) };
      }),
    }));
  },

  removeMeal(id: string) {
    set((d) => ({ ...d, meals: d.meals.filter((m) => m.id !== id) }));
  },

  toggleExercise(exerciseId: string) {
    set((d) =>
      updateDay(d, (day) => {
        const completed = day.completed.includes(exerciseId)
          ? day.completed.filter((id) => id !== exerciseId)
          : [...day.completed, exerciseId];
        return { ...day, completed };
      }),
    );
  },

  setAdaptation(constraint: Constraint | undefined) {
    set((d) =>
      updateDay(d, (day) => {
        // Keep moves already done that are still part of the adapted session.
        const base = d.profile ? sessionFor(d.profile.split) : null;
        const keepIds = new Set(base ? adapt(base, constraint).exercises.map((e) => e.id) : []);
        return { ...day, adaptation: constraint, completed: day.completed.filter((id) => keepIds.has(id)) };
      }),
    );
  },

  setWorkoutStatus(status: WorkoutDay["status"]) {
    set((d) => updateDay(d, (day) => ({ ...day, status })));
  },

  logReps(reps: number, exerciseId = "squat") {
    set((d) =>
      updateDay(d, (day) => ({
        ...day,
        reps: (day.reps ?? 0) + reps,
        completed: day.completed.includes(exerciseId) ? day.completed : [...day.completed, exerciseId],
      })),
    );
  },

  /** Record what the guided player finished. Marks the session done when every move is complete. */
  finishGuidedWorkout(result: { completed: string[]; seconds: number; sets: number; allDone: boolean }) {
    set((d) =>
      updateDay(d, (day) => ({
        ...day,
        completed: Array.from(new Set([...day.completed, ...result.completed])),
        seconds: (day.seconds ?? 0) + Math.round(result.seconds),
        sets: (day.sets ?? 0) + result.sets,
        status: result.allDone ? "done" : day.status,
      })),
    );
  },

  setCheckIn(patch: Partial<Omit<CheckIn, "date">>, key = dateKey()) {
    set((d) => {
      const current = d.checkins?.[key] ?? { date: key, water: 0 };
      const next: CheckIn = { ...current, ...patch, date: key };
      next.water = Math.max(0, Math.min(16, Math.round(next.water)));
      if (next.sleep !== undefined) next.sleep = Math.max(0, Math.min(14, next.sleep));
      return { ...d, checkins: { ...(d.checkins ?? {}), [key]: next } };
    });
  },

  logRecovery(minutes: number, kind: "guided" | "live" = "guided") {
    set((d) => ({
      ...d,
      snoozedUntil: undefined,
      recovery: [...d.recovery, { id: uid("r"), date: dateKey(), at: new Date().toISOString(), minutes, kind }],
    }));
  },

  snoozeRecovery(minutes = 30) {
    set((d) => ({ ...d, snoozedUntil: new Date(Date.now() + minutes * 60000).toISOString() }));
  },

  addMessage(role: Message["role"], text: string, action?: CoachAction) {
    set((d) => ({ ...d, messages: [...d.messages, say(role, text, action)] }));
  },

  clearChat() {
    set((d) => ({ ...d, messages: [] }));
  },

  exportCsv() {
    const d = data;
    if (!d) return;
    const rows = [["Date", "Time", "Meal", "Calories", "Protein (g)", "Source"]];
    for (const m of [...d.meals].reverse()) {
      rows.push([m.date, new Date(m.at).toLocaleTimeString(), m.name, String(m.calories), String(m.protein), m.source]);
    }
    const csv = rows.map((r) => r.map((v) => `"${v.replaceAll('"', '""')}"`).join(",")).join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `swasthya-meals-${dateKey()}.csv`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  },

  /** Download everything as one JSON file (data lives only in this browser). */
  exportBackup() {
    const d = data;
    if (!d) return;
    const url = URL.createObjectURL(new Blob([JSON.stringify(d)], { type: "application/json" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `swasthya-backup-${dateKey()}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  },

  /** Replace all data with a backup file's contents. Returns an undo function, or null if invalid. */
  importBackup(text: string) {
    if (text.length > 8_000_000) return null;
    let parsed: AppData | null = null;
    try {
      parsed = sanitize(JSON.parse(text));
    } catch {
      return null;
    }
    if (!parsed?.profile) return null;
    const next = parsed;
    return actions.withUndo(() => set(() => next));
  },

  reset() {
    set(() => empty());
  },
};
