"use client";

import { useSyncExternalStore } from "react";

import { adapt, sessionFor } from "@/lib/plan";
import type { AppData, Constraint, Meal, Message, Profile, WorkoutDay } from "@/lib/types";
import { dateKey, uid } from "@/lib/utils";

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
});

let data: AppData | null = null; // null until hydrated on the client
const listeners = new Set<() => void>();

function load(): AppData {
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return empty();
    const parsed = JSON.parse(raw) as AppData;
    return parsed?.version === 2 ? { ...empty(), ...parsed } : empty();
  } catch {
    return empty();
  }
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
  const meals = d.meals.filter((m) => m.date === key);
  const day: WorkoutDay = d.workouts[key] ?? { date: key, status: "planned", completed: [] };
  const base = d.profile ? sessionFor(d.profile.split, date) : null;
  const session = base ? adapt(base, day.adaptation) : null;
  return {
    key,
    meals,
    calories: meals.reduce((s, m) => s + m.calories, 0),
    protein: meals.reduce((s, m) => s + m.protein, 0),
    day,
    session,
    recovered: d.recovery.some((r) => r.date === key),
    recoveryMinutes: d.recovery.filter((r) => r.date === key).reduce((s, r) => s + r.minutes, 0),
  };
}

export function totalsFor(d: AppData, key: string) {
  const meals = d.meals.filter((m) => m.date === key);
  return {
    calories: meals.reduce((s, m) => s + m.calories, 0),
    protein: meals.reduce((s, m) => s + m.protein, 0),
    workout: d.workouts[key]?.status === "done",
    recovered: d.recovery.some((r) => r.date === key),
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

/* ---------- actions ---------- */

function say(role: Message["role"], text: string): Message {
  return { id: uid("m"), role, text, at: new Date().toISOString() };
}

function updateDay(d: AppData, fn: (day: WorkoutDay) => WorkoutDay): AppData {
  const key = dateKey();
  const day = d.workouts[key] ?? { date: key, status: "planned", completed: [] };
  return { ...d, workouts: { ...d.workouts, [key]: fn(day) } };
}

export const actions = {
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
    set((d) => updateDay(d, (day) => ({ ...day, adaptation: constraint, completed: [] })));
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

  addMessage(role: Message["role"], text: string) {
    set((d) => ({ ...d, messages: [...d.messages, say(role, text)] }));
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

  reset() {
    set(() => empty());
  },
};
