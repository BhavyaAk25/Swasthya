"use client";

import { AnimatePresence, motion, useIsPresent } from "framer-motion";
import { Check, Pause, Play, SkipForward, Volume2, VolumeX } from "lucide-react";
import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from "react";

import { useApp } from "@/components/app";
import { ExerciseDemoScene } from "@/components/three";
import { Bar, Button, calm, IconButton, Ring, Sheet } from "@/components/ui";
import { actions, todayOf } from "@/lib/store";
import type { Session } from "@/lib/types";
import { cn } from "@/lib/utils";
import { buildSteps, clock, completedExercises, restBefore, type Step } from "@/lib/workout";
import { cancelVoice, prefetchVoice, say, voiceSupported } from "@/lib/voice";
import { FIXED, restCue, workCue } from "@/lib/voice-phrases";

const ease = [0.22, 1, 0.36, 1] as const;
const swap = {
  initial: { opacity: 0, y: 10 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -6 },
  transition: { duration: 0.3, ease },
};
const soft = {
  initial: { opacity: 0, y: 6 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -4 },
  transition: { duration: 0.3, ease },
};

type Progress = { completed: string[]; seconds: number; sets: number; allDone: boolean; finished: boolean };

export function WorkoutPlayer({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { data, toast } = useApp();
  const today = todayOf(data);
  // adapt() builds a fresh object each call; keep one session per plan so the player never resets mid-set.
  const sessionKey = `${today.key}|${data.profile?.split}|${today.day.adaptation ?? ""}`;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const session = useMemo(() => today.session, [sessionKey]);
  const progress = useRef<Progress | null>(null);

  const report = useCallback((p: Progress) => {
    progress.current = p;
  }, []);

  const save = useCallback(
    (p: Progress, message: string) => {
      progress.current = null;
      if (p.sets > 0) {
        actions.finishGuidedWorkout({ completed: p.completed, seconds: p.seconds, sets: p.sets, allDone: p.allDone });
        toast(message);
      }
      onClose();
    },
    [onClose, toast],
  );

  // Sheet close (X, Escape, backdrop): keep whatever was done.
  const requestClose = useCallback(() => {
    cancelVoice();
    const p = progress.current;
    if (p && p.sets > 0) {
      save(p.finished ? p : { ...p, allDone: false }, p.finished ? "Session saved" : "Progress saved");
    } else {
      progress.current = null;
      onClose();
    }
  }, [onClose, save]);

  return (
    <Sheet open={open} onClose={requestClose} title={session?.title ?? "Workout"} size="lg">
      {session && session.exercises.length ? (
        <Player session={session} onReport={report} onSave={(p) => save(p, "Session saved")} />
      ) : (
        <div className="grid min-h-[280px] place-items-center text-center text-ink-soft">Nothing planned today.</div>
      )}
    </Sheet>
  );
}

/* ---------------------------------------------------------------- state */

type Phase = "ready" | "work" | "rest" | "done";
type State = {
  phase: Phase;
  index: number; // current step (work) or the upcoming step (rest)
  paused: boolean;
  elapsed: number; // active seconds, excludes paused time
  phaseElapsed: number; // seconds into the current timed step / rest
  restTotal: number;
  done: number[]; // step indexes completed
};
type Action =
  | { type: "begin" }
  | { type: "tick"; dt: number }
  | { type: "toggle" }
  | { type: "complete" }
  | { type: "skipExercise" }
  | { type: "skipRest" }
  | { type: "addRest"; seconds: number };

const initial: State = { phase: "ready", index: 0, paused: false, elapsed: 0, phaseElapsed: 0, restTotal: 0, done: [] };

function complete(steps: Step[], s: State): State {
  const done = s.done.includes(s.index) ? s.done : [...s.done, s.index];
  const next = s.index + 1;
  const rest = restBefore(steps, next);
  if (rest === null) return { ...s, done, phase: "done", paused: false, phaseElapsed: 0 };
  return { ...s, done, phase: "rest", index: next, phaseElapsed: 0, restTotal: rest };
}

function reduce(steps: Step[], s: State, a: Action): State {
  switch (a.type) {
    case "begin":
      return { ...initial, phase: "work" };
    case "toggle":
      return s.phase === "work" || s.phase === "rest" ? { ...s, paused: !s.paused } : s;
    case "tick": {
      if (s.paused || (s.phase !== "work" && s.phase !== "rest")) return s;
      const dt = Math.max(0, a.dt);
      const t: State = { ...s, elapsed: s.elapsed + dt, phaseElapsed: s.phaseElapsed + dt };
      if (s.phase === "rest") return t.phaseElapsed >= s.restTotal ? { ...t, phase: "work", phaseElapsed: 0 } : t;
      const step = steps[s.index];
      if (step.kind === "time" && t.phaseElapsed >= (step.seconds ?? 0)) return complete(steps, t);
      return t;
    }
    case "complete":
      return s.phase === "work" ? complete(steps, s) : s;
    case "skipExercise": {
      if (s.phase !== "work" && s.phase !== "rest") return s;
      const id = steps[s.index].exerciseId;
      let j = s.index;
      while (j < steps.length && steps[j].exerciseId === id) j++;
      if (j >= steps.length) return { ...s, phase: "done", paused: false, phaseElapsed: 0 };
      return { ...s, phase: "work", index: j, phaseElapsed: 0 };
    }
    case "skipRest":
      return s.phase === "rest" ? { ...s, phase: "work", phaseElapsed: 0 } : s;
    case "addRest":
      return s.phase === "rest" ? { ...s, restTotal: s.restTotal + a.seconds } : s;
  }
}

/* ---------------------------------------------------------------- player */

function Player({
  session,
  onReport,
  onSave,
}: {
  session: Session;
  onReport: (p: Progress) => void;
  onSave: (p: Progress) => void;
}) {
  const steps = useMemo(() => buildSteps(session), [session]);
  const [state, dispatch] = useReducer((s: State, a: Action) => reduce(steps, s, a), initial);
  const [voice, setVoice] = useState(true);
  const [canSpeak] = useState(voiceSupported);
  const present = useIsPresent(); // false while the sheet animates out
  const spokenCue = useRef("");
  const spokenCount = useRef("");

  const { phase, index, paused } = state;
  const step = steps[Math.min(index, steps.length - 1)];
  const running = present && !paused && (phase === "work" || phase === "rest");
  const timed = phase === "rest" || (phase === "work" && step.kind === "time");
  const phaseTotal = phase === "rest" ? state.restTotal : (step.seconds ?? 0);
  const remaining = timed ? Math.max(0, Math.ceil(phaseTotal - state.phaseElapsed)) : 0;

  const doneSet = useMemo(() => new Set(state.done), [state.done]);
  const completed = useMemo(() => completedExercises(steps, doneSet), [steps, doneSet]);
  const moveCount = useMemo(() => new Set(steps.map((s) => s.exerciseId)).size, [steps]);
  const moves = useMemo(
    () => session.exercises.filter((e, i, all) => all.findIndex((x) => x.id === e.id) === i),
    [session.exercises],
  );
  const nextMove = steps.slice(index + 1).find((s) => s.exerciseId !== step.exerciseId);

  // Timestamp clock: deltas from performance.now, so throttled tabs stay accurate.
  useEffect(() => {
    if (!running) return;
    let last = performance.now();
    const t = setInterval(() => {
      const now = performance.now();
      dispatch({ type: "tick", dt: (now - last) / 1000 });
      last = now;
    }, 250);
    return () => clearInterval(t);
  }, [running]);

  // Share progress with the wrapper so a mid-session close can keep it.
  useEffect(() => {
    if (!present) return;
    onReport({
      completed,
      seconds: state.elapsed,
      sets: state.done.length,
      allDone: completed.length === moveCount,
      finished: phase === "done",
    });
  }, [present, onReport, completed, state.elapsed, state.done.length, moveCount, phase]);

  // Spoken cue once per phase/step.
  const cueKey = `${phase}:${index}`;
  useEffect(() => {
    if (!canSpeak || !voice || !present || paused || phase === "ready" || spokenCue.current === cueKey) return;
    spokenCue.current = cueKey;
    if (phase === "work") void say(workCue(step));
    else if (phase === "rest") void say(restCue(step));
    else if (phase === "done" && state.done.length > 0) void say([FIXED.complete]);
  }, [canSpeak, voice, present, paused, phase, cueKey, step, state.done.length]);

  // Three, two, one.
  useEffect(() => {
    if (!canSpeak || !voice || !running || !timed || remaining < 1 || remaining > 3) return;
    const key = `${cueKey}:${remaining}`;
    if (spokenCount.current === key) return;
    spokenCount.current = key;
    void say([FIXED.count[remaining - 1]]);
  }, [canSpeak, voice, running, timed, remaining, cueKey]);

  // Silence on pause, mute, exit and unmount.
  useEffect(() => {
    if (!canSpeak) return;
    if (paused || !voice || !present) cancelVoice();
    if (!voice) spokenCue.current = "";
  }, [canSpeak, paused, voice, present]);
  useEffect(() => () => cancelVoice(), []);

  // Warm this session's recorded cues.
  useEffect(() => {
    prefetchVoice([...steps.flatMap((s) => [...workCue(s), ...restCue(s)]), FIXED.complete, ...FIXED.count]);
  }, [steps]);

  // Keyboard: Space pauses, Enter advances. Never while typing.
  useEffect(() => {
    if (!present) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.defaultPrevented || e.metaKey || e.ctrlKey || e.altKey) return;
      const el = e.target as HTMLElement | null;
      if (el && (el.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName))) return;
      if (e.key === " " || e.code === "Space") {
        if (phase !== "work" && phase !== "rest") return;
        if (el && el.closest("button, a")) return; // Space on a focused button presses that button
        e.preventDefault();
        dispatch({ type: "toggle" });
      } else if (e.key === "Enter") {
        if (el && el.closest("button, a")) return; // let focused controls act natively
        if (phase === "ready") dispatch({ type: "begin" });
        else if (phase === "work") dispatch({ type: "complete" });
        else if (phase === "rest") dispatch({ type: "skipRest" });
        else return;
        e.preventDefault();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [present, phase]);

  const voiceToggle = (
    <IconButton
      icon={voice && canSpeak ? Volume2 : VolumeX}
      label={voice ? "Mute voice" : "Unmute voice"}
      onClick={() => setVoice((v) => !v)}
      disabled={!canSpeak}
      className="disabled:opacity-40"
    />
  );

  return (
    <div className="pb-1 pt-1">
      <div className={cn("mb-5 flex h-5 items-center gap-3 transition-opacity duration-300", phase === "work" || phase === "rest" ? "opacity-100" : "opacity-0")}>
        <div className="min-w-0 flex-1">
          <Bar value={state.done.length / steps.length} />
        </div>
        <span className="shrink-0 text-[12px] font-medium tabular-nums text-ink-faint">{clock(state.elapsed)}</span>
      </div>

      {/* The shared character player keeps fixed framing through work and rest phases. */}
      <motion.div
        initial={false}
        animate={{ height: phase === "done" ? 0 : "auto", opacity: phase === "done" ? 0 : 1 }}
        transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
        className="overflow-hidden"
      >
        <div className="mb-5 overflow-hidden rounded-[24px] border border-line bg-[radial-gradient(110%_100%_at_50%_10%,#fbfaf6_0%,#eef1ec_55%,#e2e8e4_100%)]">
          <ExerciseDemoScene
            exerciseId={(phase === "ready" ? steps[0] : step).exerciseId}
            playing={phase === "ready" || (phase === "work" && !paused)}
            className="h-[210px] w-full sm:h-[280px]"
          />
        </div>
      </motion.div>

      <div className="min-h-[300px] sm:min-h-[260px]">
        <AnimatePresence mode="wait" initial={false}>
          {phase === "ready" ? (
            <motion.div key="ready" {...swap}>
              <div className="min-w-0">
                <div className="eyebrow">
                  {moveCount} moves · {session.minutes} min
                </div>
                <ul className="mt-4 grid grid-cols-2 gap-2">
                  {moves.map((e) => (
                    <li key={e.id} className="min-w-0 rounded-[18px] bg-surface-2/70 px-3.5 py-2.5 sm:flex sm:items-baseline sm:justify-between sm:gap-3">
                      <div className="truncate text-[14px] font-medium">{e.name}</div>
                      <div className="mt-0.5 shrink-0 text-[12px] tabular-nums text-ink-faint sm:mt-0">{e.sets}</div>
                    </li>
                  ))}
                </ul>
                <div className="mt-6 flex items-center gap-3">
                  {voiceToggle}
                  <Button size="lg" icon={Play} className="flex-1" onClick={() => dispatch({ type: "begin" })}>
                    Begin
                  </Button>
                </div>
              </div>
            </motion.div>
          ) : phase === "work" ? (
            <motion.div key="work" {...swap}>
              <div>
                <div className="flex min-w-0 items-center justify-between gap-4">
                  <div className="min-w-0">
                    <div className="h-4">
                      <AnimatePresence mode="wait" initial={false}>
                        <motion.div key={paused ? "paused" : `set-${index}`} {...soft} className="eyebrow">
                          {paused ? "Paused" : `Set ${step.set} of ${step.totalSets}`}
                        </motion.div>
                      </AnimatePresence>
                    </div>
                    <div className="mt-2 min-h-[64px] sm:min-h-[76px]">
                      <AnimatePresence mode="wait" initial={false}>
                        <motion.h3 key={step.exerciseId} {...soft} className="font-display text-[26px] leading-tight sm:text-[34px]">
                          {step.name}
                        </motion.h3>
                      </AnimatePresence>
                    </div>
                    <div className="mt-1 hidden h-5 truncate text-[13px] text-ink-faint sm:block">
                      {nextMove ? `Next: ${nextMove.name}` : "Final move"}
                    </div>
                  </div>
                  <div className="grid h-[120px] shrink-0 place-items-center">
                    <AnimatePresence mode="wait" initial={false}>
                      <motion.div key={`target-${index}`} {...soft}>
                        <Target step={step} remaining={remaining} />
                      </motion.div>
                    </AnimatePresence>
                  </div>
                </div>
              </div>

              <div className="mt-2 h-5 truncate text-[13px] text-ink-faint sm:hidden">
                {nextMove ? `Next: ${nextMove.name}` : "Final move"}
              </div>

              <div className="mt-5 flex items-center gap-3">
                {voiceToggle}
                <Button size="lg" variant="soft" icon={Check} className="min-w-0 flex-1 px-4!" onClick={() => dispatch({ type: "complete" })}>
                  {step.kind === "time" ? "Done" : "Done set"}
                </Button>
                <PauseButton paused={paused} onClick={() => dispatch({ type: "toggle" })} />
                <IconButton icon={SkipForward} label="Skip exercise" onClick={() => dispatch({ type: "skipExercise" })} />
              </div>
            </motion.div>
          ) : phase === "rest" ? (
            <motion.div key="rest" {...swap} className="mx-auto flex max-w-md flex-col items-center text-center">
              <div className="h-4">
                <AnimatePresence mode="wait" initial={false}>
                  <motion.div key={paused ? "paused" : "rest"} {...soft} className="eyebrow">
                    {paused ? "Paused" : "Rest"}
                  </motion.div>
                </AnimatePresence>
              </div>
              <div className="mt-3">
                <Ring value={state.restTotal ? 1 - state.phaseElapsed / state.restTotal : 0} size={140} stroke={4} color="var(--sage)">
                  <span className="font-display text-4xl tabular-nums">{clock(remaining)}</span>
                </Ring>
              </div>

              <div className="mt-5 flex w-full items-center gap-4 rounded-[24px] bg-surface-2/70 px-5 py-3 text-left">
                <div className="min-w-0">
                  <div className="eyebrow">Up next</div>
                  <div className="mt-1 truncate font-display text-xl">{step.name}</div>
                  <div className="mt-0.5 text-[13px] tabular-nums text-ink-faint">
                    Set {step.set} of {step.totalSets} · {targetLabel(step)}
                  </div>
                </div>
              </div>

              <div className="mt-6 flex w-full items-center gap-3">
                {voiceToggle}
                <Button size="lg" variant="outline" className="min-w-0 flex-1 px-4!" onClick={() => dispatch({ type: "addRest", seconds: 15 })}>
                  +15s
                </Button>
                <Button size="lg" icon={SkipForward} className="min-w-0 flex-1 px-4!" onClick={() => dispatch({ type: "skipRest" })}>
                  Skip rest
                </Button>
              </div>
            </motion.div>
          ) : (
            <motion.div key="done" {...swap} className="mx-auto flex max-w-md flex-col items-center pt-4 text-center">
              <Ring value={state.done.length / steps.length} size={132} stroke={4} color="var(--moss)">
                <Check className="h-9 w-9 text-moss" strokeWidth={1.6} />
              </Ring>
              <div className="mt-7 font-display text-3xl">{state.done.length ? "Well done" : "Session ended"}</div>
              <div className="mt-8 grid w-full grid-cols-3 gap-3">
                <Summary label="Time" value={clock(state.elapsed)} />
                <Summary label="Sets" value={`${state.done.length}`} />
                <Summary label="Moves" value={`${completed.length}/${moveCount}`} />
              </div>
              <Button
                size="lg"
                className="mt-9 w-full"
                onClick={() =>
                  onSave({
                    completed,
                    seconds: state.elapsed,
                    sets: state.done.length,
                    allDone: completed.length === moveCount,
                    finished: true,
                  })
                }
              >
                {state.done.length ? "Save" : "Close"}
              </Button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

function targetLabel(step: Step) {
  if (step.kind === "time") return `${clock(step.seconds ?? 0)}${step.perSide ? " / side" : ""}`;
  return step.perSide ? `${step.reps} / side` : `${step.reps} reps`;
}

function Target({ step, remaining }: { step: Step; remaining: number }) {
  if (step.kind === "time") {
    const total = step.seconds ?? 1;
    return (
      <>
        <div className="sm:hidden">
          <Ring value={remaining / total} size={116} stroke={4}>
            <span className="font-display text-[26px] tabular-nums">{clock(remaining)}</span>
          </Ring>
        </div>
        <div className="hidden sm:block">
          <Ring value={remaining / total} size={164} stroke={5}>
            <span className="font-display text-4xl tabular-nums">{clock(remaining)}</span>
          </Ring>
        </div>
      </>
    );
  }
  return (
    <div className="flex items-baseline gap-2">
      <span className="font-display text-6xl tabular-nums leading-none sm:text-7xl">{step.reps}</span>
      <span className="text-[15px] text-ink-soft">{step.perSide ? "/ side" : "reps"}</span>
    </div>
  );
}

function PauseButton({ paused, onClick }: { paused: boolean; onClick: () => void }) {
  return (
    <motion.button
      type="button"
      aria-label={paused ? "Resume" : "Pause"}
      onClick={onClick}
      whileTap={{ scale: 0.92 }}
      transition={calm}
      className="grid h-14 w-14 shrink-0 place-items-center rounded-full bg-moss text-white shadow-[0_10px_30px_-10px_rgba(61,90,79,0.8)]"
    >
      {paused ? <Play className="ml-0.5 h-5 w-5" strokeWidth={1.8} /> : <Pause className="h-5 w-5" strokeWidth={1.8} />}
    </motion.button>
  );
}

function Summary({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[20px] bg-surface-2/70 px-3 py-4">
      <div className="eyebrow">{label}</div>
      <div className="mt-1.5 font-display text-2xl tabular-nums">{value}</div>
    </div>
  );
}
