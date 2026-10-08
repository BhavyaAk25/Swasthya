"use client";

import { AnimatePresence, motion } from "framer-motion";
import { Check, ScanLine, Undo2 } from "lucide-react";
import { useEffect, useRef } from "react";

import { useApp } from "@/components/app";
import { Bar, Button, calm, Card, Chip, ImageSlot } from "@/components/ui";
import { IMAGES } from "@/lib/images";
import { CONSTRAINTS, weekFor } from "@/lib/plan";
import { actions, todayOf } from "@/lib/store";
import { cn } from "@/lib/utils";

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export function MoveView() {
  const { data, open, toast } = useApp();
  const profile = data.profile!;
  const t = todayOf(data);
  const session = t.session!;
  const note = "note" in session ? (session.note as string | undefined) : undefined;
  const done = t.day.status === "done";
  const completed = t.day.completed.filter((id) => session.exercises.some((e) => e.id === id)).length;
  const progress = session.exercises.length ? completed / session.exercises.length : 0;
  const today = new Date().getDay();

  // Finishing every move completes the session automatically (once).
  const wasComplete = useRef(progress === 1);
  useEffect(() => {
    if (progress === 1 && !wasComplete.current && !done) {
      actions.setWorkoutStatus("done");
      toast("Session complete. Well done.");
    }
    wasComplete.current = progress === 1;
  }, [progress, done, toast]);

  return (
    <div className="space-y-6 lg:space-y-8">
      <header>
        <div className="eyebrow">Move</div>
        <h1 className="mt-2 font-display text-4xl font-light sm:text-5xl">{session.title}</h1>
        <p className="mt-2 text-ink-soft">
          {session.focus} · {session.minutes} min
        </p>
      </header>

      <div className="grid gap-4 [&>*]:min-w-0 lg:grid-cols-[1.35fr_1fr] lg:gap-6">
        <div className="space-y-4 lg:space-y-6">
          {/* How do you feel */}
          <Card>
            <div className="eyebrow">How do you feel?</div>
            <div className="no-scrollbar -mx-5 mt-4 flex gap-2 overflow-x-auto px-5 sm:mx-0 sm:flex-wrap sm:px-0">
              <Chip active={!t.day.adaptation} onClick={() => actions.setAdaptation(undefined)}>
                Good
              </Chip>
              {CONSTRAINTS.map((c) => (
                <Chip key={c.id} active={t.day.adaptation === c.id} onClick={() => actions.setAdaptation(c.id)}>
                  {c.label}
                </Chip>
              ))}
            </div>
            <AnimatePresence initial={false} mode="popLayout">
              {note ? (
                <motion.p
                  key={note}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  transition={calm}
                  className="mt-4 rounded-2xl bg-moss-soft/60 px-4 py-3 text-sm text-moss"
                >
                  {note}
                </motion.p>
              ) : null}
            </AnimatePresence>
          </Card>

          {/* Checklist */}
          <Card>
            <div className="flex items-center justify-between">
              <div className="eyebrow">Moves</div>
              <span className="text-sm tabular-nums text-ink-faint">
                {completed}/{session.exercises.length}
              </span>
            </div>
            <div className="mt-3">
              <Bar value={progress} />
            </div>
            <ul className="mt-4 divide-y divide-line">
              {session.exercises.map((ex) => {
                const checked = t.day.completed.includes(ex.id);
                return (
                  <motion.li key={ex.id} layout transition={calm} className="flex items-center gap-4 py-3">
                    <motion.button
                      type="button"
                      aria-label={checked ? `Mark ${ex.name} not done` : `Mark ${ex.name} done`}
                      onClick={() => actions.toggleExercise(ex.id)}
                      whileTap={{ scale: 0.88 }}
                      transition={calm}
                      className={cn(
                        "grid h-9 w-9 shrink-0 place-items-center rounded-full border",
                        checked ? "border-transparent bg-moss text-white" : "border-line text-transparent hover:border-sage",
                      )}
                    >
                      <AnimatePresence>
                        {checked ? (
                          <motion.span initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }} transition={calm}>
                            <Check className="h-4 w-4" strokeWidth={2.4} />
                          </motion.span>
                        ) : null}
                      </AnimatePresence>
                    </motion.button>
                    <button type="button" onClick={() => actions.toggleExercise(ex.id)} className="min-w-0 flex-1 text-left">
                      <div className={cn("font-medium", checked && "text-ink-faint line-through decoration-ink/20")}>{ex.name}</div>
                      <div className="text-sm text-ink-faint">{ex.sets}</div>
                    </button>
                    {ex.squat ? (
                      <Button size="sm" variant="soft" icon={ScanLine} onClick={() => open("squats")}>
                        Count
                      </Button>
                    ) : null}
                  </motion.li>
                );
              })}
            </ul>
            {typeof t.day.reps === "number" && t.day.reps > 0 ? (
              <p className="mt-2 text-sm text-ink-soft">{t.day.reps} squats counted by camera today.</p>
            ) : null}
            <div className="mt-5">
              <AnimatePresence mode="wait" initial={false}>
                {done ? (
                  <motion.div key="done" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={calm} className="flex items-center justify-between gap-3 rounded-2xl bg-moss-soft/60 px-4 py-3">
                    <span className="flex items-center gap-2 text-sm font-medium text-moss">
                      <Check className="h-4 w-4" /> Done for today
                    </span>
                    <Button size="sm" variant="ghost" icon={Undo2} onClick={() => actions.setWorkoutStatus("planned")}>
                      Undo
                    </Button>
                  </motion.div>
                ) : (
                  <motion.div key="todo" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={calm}>
                    <Button
                      className="w-full"
                      onClick={() => {
                        actions.setWorkoutStatus("done");
                        toast("Session logged");
                      }}
                    >
                      Mark session done
                    </Button>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </Card>
        </div>

        <div className="space-y-4 lg:space-y-6">
          <ImageSlot src={IMAGES.move} tone="mist" label="Image" className="hidden h-64 lg:block" />
          <Card>
            <div className="eyebrow">Your week</div>
            <ul className="mt-4 space-y-1">
              {weekFor(profile.split).map((s, day) => (
                <li
                  key={day}
                  className={cn(
                    "flex items-center justify-between rounded-2xl px-3 py-2.5 text-sm",
                    day === today ? "bg-surface-2 font-medium" : "text-ink-soft",
                  )}
                >
                  <span className="w-12 text-ink-faint">{WEEKDAYS[day]}</span>
                  <span className="flex-1">{s.title}</span>
                  <span className="text-ink-faint">{s.minutes}m</span>
                </li>
              ))}
            </ul>
          </Card>
        </div>
      </div>
    </div>
  );
}
