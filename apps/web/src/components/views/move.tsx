"use client";

import { AnimatePresence, motion } from "framer-motion";
import { Check, Play, ScanLine, Undo2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { useApp } from "@/components/app";
import { ExerciseDemoScene } from "@/components/three";
import { Bar, Button, calm, Card, Chip } from "@/components/ui";
import { CONSTRAINTS, weekFor } from "@/lib/plan";
import { FORM } from "@/lib/form";
import { actions, todayOf } from "@/lib/store";
import { stageStyle } from "@/lib/stages";
import { cn } from "@/lib/utils";

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export function MoveView() {
  const { data, open, toast, covered } = useApp();
  const profile = data.profile!;
  const t = todayOf(data);
  const session = t.session!;
  const note = "note" in session ? (session.note as string | undefined) : undefined;
  const done = t.day.status === "done";
  const completed = t.day.completed.filter((id) => session.exercises.some((e) => e.id === id)).length;
  const progress = session.exercises.length ? completed / session.exercises.length : 0;
  const today = new Date().getDay();

  // The demo follows the first unfinished move unless the user picks one.
  const firstOpen = session.exercises.find((e) => !t.day.completed.includes(e.id)) ?? session.exercises[0];
  const [picked, setPicked] = useState<string | null>(null);
  const selected = session.exercises.find((e) => e.id === picked) ?? firstOpen;

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
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          <div className="eyebrow">Move</div>
          <h1 className="mt-2 font-display text-4xl font-light sm:text-5xl">{session.title}</h1>
          <p className="mt-2 text-ink-soft">
            {session.focus} · {session.minutes} min · {session.exercises.length} moves
          </p>
        </div>
        {done ? null : (
          <Button size="lg" icon={Play} onClick={() => open("workout")}>
            {progress > 0 ? "Continue session" : "Start session"}
          </Button>
        )}
      </header>

      {/* Illustrated demonstration of the selected move */}
      <section data-stage="sage" style={stageStyle("sage")} className="relative overflow-hidden rounded-[32px] border border-line">
        <ExerciseDemoScene exerciseId={selected.id} active={!covered} className="h-[300px] w-full sm:h-[380px] lg:h-[440px]" />
        <div className="pointer-events-none absolute inset-x-0 bottom-0 flex items-end justify-between gap-3 p-4 sm:p-6">
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={selected.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
              className="rounded-[20px] bg-[rgba(251,250,246,0.82)] px-4 py-3 backdrop-blur-md"
            >
              <div className="font-display text-xl leading-tight">{selected.name}</div>
              <div className="text-sm text-ink-soft">{selected.sets}</div>
            </motion.div>
          </AnimatePresence>
        </div>
      </section>

      {/* How to do the selected move */}
      {FORM[selected.id] ? (
        <AnimatePresence mode="wait" initial={false}>
          <motion.section
            key={selected.id}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
            aria-label={`How to do ${selected.name}`}
            className="no-scrollbar -mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 sm:mx-0 sm:grid sm:grid-cols-[repeat(3,minmax(0,1fr))_minmax(0,1.1fr)] sm:overflow-visible sm:px-0 [&>*]:min-w-0"
          >
            {FORM[selected.id].cues.map((cue, i) => (
              <div key={cue} className="flex w-[72%] shrink-0 snap-start gap-3 rounded-[20px] bg-surface px-4 py-3.5 sm:w-auto">
                <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-moss-soft text-xs font-semibold text-moss">{i + 1}</span>
                <span className="text-sm leading-snug text-ink">{cue}</span>
              </div>
            ))}
            <div className="flex w-[72%] shrink-0 snap-start gap-3 rounded-[20px] bg-clay-soft/60 px-4 py-3.5 sm:w-auto">
              <span className="text-xs font-semibold uppercase tracking-[0.14em] text-[#8a6440]">Avoid</span>
              <span className="text-sm leading-snug text-ink-soft">{FORM[selected.id].avoid}</span>
            </div>
          </motion.section>
        </AnimatePresence>
      ) : null}

      <div className="grid gap-4 [&>*]:min-w-0 lg:grid-cols-[1.35fr_1fr] lg:gap-6">
        <div className="space-y-4 lg:space-y-6">
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
            <ul className="mt-3">
              {session.exercises.map((ex) => {
                const checked = t.day.completed.includes(ex.id);
                const isSel = ex.id === selected.id;
                return (
                  <motion.li key={ex.id} layout transition={calm} className="relative flex items-center gap-3 py-1.5">
                    {isSel ? <motion.span layoutId="move-sel" transition={calm} className="absolute inset-0 -mx-3 rounded-2xl bg-surface-2" /> : null}
                    <motion.button
                      type="button"
                      aria-label={checked ? `Mark ${ex.name} not done` : `Mark ${ex.name} done`}
                      onClick={() => actions.toggleExercise(ex.id)}
                      whileTap={{ scale: 0.88 }}
                      transition={calm}
                      className={cn(
                        "relative grid h-9 w-9 shrink-0 place-items-center rounded-full border",
                        checked ? "border-transparent bg-moss text-white" : "border-line bg-surface text-transparent hover:border-sage",
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
                    <button
                      type="button"
                      onClick={() => setPicked(ex.id)}
                      aria-pressed={isSel}
                      aria-label={`Show ${ex.name}`}
                      className="relative min-w-0 flex-1 py-2 text-left"
                    >
                      <div className={cn("truncate font-medium", checked && "text-ink-faint line-through decoration-ink/20")}>{ex.name}</div>
                      <div className="text-sm text-ink-faint">{ex.sets}</div>
                    </button>
                    {ex.squat ? (
                      <Button size="sm" variant="soft" icon={ScanLine} onClick={() => open("squats")} className="relative">
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
                  <motion.div
                    key="done"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={calm}
                    className="flex items-center justify-between gap-3 rounded-2xl bg-moss-soft/60 px-4 py-3"
                  >
                    <span className="flex items-center gap-2 text-sm font-medium text-moss">
                      <Check className="h-4 w-4" /> Done for today
                      {t.day.seconds ? <span className="font-normal text-moss/70"> · {Math.round(t.day.seconds / 60)} min</span> : null}
                    </span>
                    <Button size="sm" variant="ghost" icon={Undo2} onClick={() => actions.setWorkoutStatus("planned")}>
                      Undo
                    </Button>
                  </motion.div>
                ) : (
                  <motion.div key="todo" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={calm} className="flex items-center justify-between gap-3">
                    <span className="text-sm text-ink-faint">Trained without the player?</span>
                    <Button
                      variant="outline"
                      onClick={() => {
                        toast("Session logged", actions.withUndo(() => actions.setWorkoutStatus("done")));
                      }}
                    >
                      Mark done
                    </Button>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </Card>
        </div>

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
