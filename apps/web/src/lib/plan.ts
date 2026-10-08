import type { Constraint, Session, Split } from "@/lib/types";

const lower: Session = {
  id: "lower",
  title: "Lower body",
  focus: "Strength",
  minutes: 30,
  exercises: [
    { id: "squat", name: "Bodyweight squats", sets: "3 × 12", squat: true },
    { id: "split", name: "Split squats", sets: "3 × 10 / side" },
    { id: "bridge", name: "Glute bridges", sets: "3 × 15" },
    { id: "calf", name: "Calf raises", sets: "2 × 20" },
  ],
};

const upper: Session = {
  id: "upper",
  title: "Upper body",
  focus: "Push & pull",
  minutes: 28,
  exercises: [
    { id: "pushup", name: "Push-ups", sets: "4 × 10" },
    { id: "row", name: "Backpack rows", sets: "3 × 12" },
    { id: "pike", name: "Pike push-ups", sets: "3 × 8" },
    { id: "plank", name: "Plank", sets: "3 × 40s" },
  ],
};

const full: Session = {
  id: "full",
  title: "Full body",
  focus: "Total strength",
  minutes: 32,
  exercises: [
    { id: "squat", name: "Bodyweight squats", sets: "3 × 12", squat: true },
    { id: "pushup", name: "Push-ups", sets: "3 × 10" },
    { id: "lunge", name: "Reverse lunges", sets: "3 × 8 / side" },
    { id: "deadbug", name: "Dead bugs", sets: "3 × 10" },
  ],
};

const flow: Session = {
  id: "flow",
  title: "Mobility flow",
  focus: "Breath & range",
  minutes: 15,
  rest: true,
  exercises: [
    { id: "cat", name: "Cat–cow", sets: "2 min" },
    { id: "hip", name: "Hip openers", sets: "4 min" },
    { id: "twist", name: "Thoracic twists", sets: "3 min" },
    { id: "fold", name: "Forward fold", sets: "2 min" },
  ],
};

// Indexed by weekday: 0 = Sunday
const WEEKS: Record<Split, Session[]> = {
  "three-day": [flow, lower, flow, upper, flow, full, flow],
  "upper-lower": [flow, upper, lower, flow, upper, lower, flow],
  "full-body": [flow, full, flow, full, flow, full, flow],
};

export const SPLITS: { id: Split; label: string; hint: string }[] = [
  { id: "three-day", label: "Three days", hint: "Mon · Wed · Fri" },
  { id: "upper-lower", label: "Upper / lower", hint: "Four days" },
  { id: "full-body", label: "Full body", hint: "Three days, all over" },
];

export const CONSTRAINTS: { id: Constraint; label: string }[] = [
  { id: "low_energy", label: "Low energy" },
  { id: "short_on_time", label: "Short on time" },
  { id: "sore", label: "Sore" },
  { id: "missed_yesterday", label: "Missed yesterday" },
];

export function sessionFor(split: Split, date = new Date()): Session {
  return WEEKS[split][date.getDay()];
}

export function weekFor(split: Split) {
  return WEEKS[split];
}

function scaleSets(sets: string, factor: number) {
  return sets.replace(/^(\d+)/, (n) => String(Math.max(1, Math.round(Number(n) * factor))));
}

/** Deterministic adaptation of a session for how the user feels today. */
export function adapt(session: Session, constraint?: Constraint): Session & { note?: string } {
  if (!constraint) return session;

  if (constraint === "short_on_time") {
    return {
      ...session,
      minutes: Math.min(session.minutes, 15),
      exercises: session.exercises.slice(0, 2),
      note: "Just the first two. Quality over volume.",
    };
  }
  if (constraint === "low_energy") {
    return {
      ...session,
      minutes: Math.round(session.minutes * 0.65),
      exercises: session.exercises.map((e) => ({ ...e, sets: scaleSets(e.sets, 0.67) })),
      note: "Lighter sets, easy tempo. Leave with energy.",
    };
  }
  if (constraint === "sore") {
    return {
      ...flow,
      id: `${session.id}-sore`,
      title: "Gentle mobility",
      note: "Swapped for mobility. Let the soreness settle.",
    };
  }
  return {
    ...session,
    exercises: session.exercises.slice(0, 3),
    note: "Main work only. No need to make up the missed day.",
  };
}
