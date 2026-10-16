import type { Session } from "@/lib/types";

/** One set of one exercise, as the guided player runs it. */
export type Step = {
  exerciseId: string;
  name: string;
  set: number; // 1-based
  totalSets: number;
  kind: "reps" | "time";
  reps?: number;
  perSide?: boolean;
  seconds?: number;
};

type ParsedSets = {
  totalSets: number;
  kind: "reps" | "time";
  reps?: number;
  perSide?: boolean;
  seconds?: number;
};

const REST_SECONDS = { betweenSets: 30, betweenExercises: 45 } as const;

const FALLBACK: ParsedSets = { totalSets: 1, kind: "reps", reps: 10 };
const SECONDS_UNIT = /^(s|sec|secs|second|seconds)$/;
const MINUTES_UNIT = /^(m|min|mins|minute|minutes)$/;

function clamp(n: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, n));
}

function toSeconds(amount: number, unit: string): number | null {
  if (SECONDS_UNIT.test(unit)) return Math.round(amount);
  if (MINUTES_UNIT.test(unit)) return Math.round(amount * 60);
  return null;
}

/**
 * Parse a plan's `sets` string.
 * "3 × 12" · "3 x 12" · "3 × 10 / side" · "3 × 40s" · "2 min" · "45s". Unknown → 1 set of 10 reps.
 */
function parseSets(sets: string): ParsedSets {
  const s = String(sets ?? "")
    .trim()
    .toLowerCase()
    .replace(/[×✕✖*]/g, "x")
    .replace(/\s+/g, " ");
  if (!s) return { ...FALLBACK };

  const perSide = /(\/\s*side|per side|each side|\/\s*leg|each leg|per leg)$/.test(s);
  const body = s.replace(/(\/\s*side|per side|each side|\/\s*leg|each leg|per leg)$/, "").trim();

  // "<sets> x <n>[unit]"
  const multi = body.match(/^(\d+)\s*x\s*(\d+(?:\.\d+)?)\s*([a-z]*)$/);
  if (multi) {
    const totalSets = clamp(Number(multi[1]), 1, 20);
    const amount = Number(multi[2]);
    const unit = multi[3];
    if (!unit || /^reps?$/.test(unit)) {
      const reps = clamp(Math.round(amount), 1, 200);
      return perSide ? { totalSets, kind: "reps", reps, perSide: true } : { totalSets, kind: "reps", reps };
    }
    const seconds = toSeconds(amount, unit);
    if (seconds !== null) {
      const sec = clamp(seconds, 5, 3600);
      return perSide ? { totalSets, kind: "time", seconds: sec, perSide: true } : { totalSets, kind: "time", seconds: sec };
    }
    return { ...FALLBACK };
  }

  // "<n><unit>" → a single timed block, or "<n> reps" → a single set
  const single = body.match(/^(\d+(?:\.\d+)?)\s*([a-z]+)$/);
  if (single) {
    const amount = Number(single[1]);
    const unit = single[2];
    if (/^reps?$/.test(unit)) return { totalSets: 1, kind: "reps", reps: clamp(Math.round(amount), 1, 200) };
    const seconds = toSeconds(amount, unit);
    if (seconds !== null) return { totalSets: 1, kind: "time", seconds: clamp(seconds, 5, 3600) };
  }

  return { ...FALLBACK };
}

/** One step per set, in session order. */
export function buildSteps(session: Session): Step[] {
  const steps: Step[] = [];
  for (const exercise of session.exercises) {
    const parsed = parseSets(exercise.sets);
    for (let set = 1; set <= parsed.totalSets; set++) {
      steps.push({ exerciseId: exercise.id, name: exercise.name, set, ...parsed });
    }
  }
  return steps;
}

/** Rest length before `steps[next]`, or null when there is nothing left. */
export function restBefore(steps: Step[], next: number): number | null {
  if (next <= 0 || next >= steps.length) return null;
  return steps[next].exerciseId === steps[next - 1].exerciseId ? REST_SECONDS.betweenSets : REST_SECONDS.betweenExercises;
}

/** Exercise ids whose every set index appears in `done`. */
export function completedExercises(steps: Step[], done: ReadonlySet<number>): string[] {
  const all = new Map<string, boolean>();
  steps.forEach((step, i) => {
    all.set(step.exerciseId, (all.get(step.exerciseId) ?? true) && done.has(i));
  });
  return [...all].filter(([, ok]) => ok).map(([id]) => id);
}

/** "1:05" */
export function clock(totalSeconds: number) {
  const s = Math.max(0, Math.floor(totalSeconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}
