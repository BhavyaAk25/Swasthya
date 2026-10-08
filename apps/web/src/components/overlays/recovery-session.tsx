"use client";

import { AnimatePresence, motion } from "framer-motion";
import { Pause, Play, SkipForward, Volume2, VolumeX } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { useApp } from "@/components/app";
import { LiveVoice } from "@/components/overlays/live-voice";
import { Button, calm, IconButton, Ring, Sheet } from "@/components/ui";
import { stepsFor } from "@/lib/recovery";
import { actions } from "@/lib/store";

export function RecoverySession({
  open,
  minutes,
  live,
  onClose,
}: {
  open: boolean;
  minutes: number;
  live?: boolean;
  onClose: () => void;
}) {
  const { data, toast } = useApp();
  const profile = data.profile!;

  const finish = useCallback(
    (mins: number, kind: "guided" | "live") => {
      if (mins >= 1) {
        actions.logRecovery(mins, kind);
        toast(`${mins} min of rest logged`);
      }
      onClose();
    },
    [onClose, toast],
  );

  return (
    <Sheet open={open} onClose={onClose} title={live ? "Live reset" : "Yoga nidra"}>
      {live ? (
        <LiveVoice name={profile.name} goal={profile.goal} onEnd={(m) => finish(m, "live")} />
      ) : (
        <Guided minutes={minutes} onFinish={(m) => finish(m, "guided")} />
      )}
    </Sheet>
  );
}

function pickVoice() {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return null;
  const voices = window.speechSynthesis.getVoices().filter((v) => v.lang.startsWith("en"));
  const preferred = ["Samantha", "Google UK English Female", "Karen", "Moira", "Serena", "Microsoft Aria", "Microsoft Jenny"];
  return voices.find((v) => preferred.some((p) => v.name.includes(p))) ?? voices.find((v) => v.localService) ?? voices[0] ?? null;
}

function Guided({ minutes, onFinish }: { minutes: number; onFinish: (minutes: number) => void }) {
  const steps = useMemo(() => stepsFor(minutes), [minutes]);
  const total = steps.reduce((s, x) => s + x.seconds, 0);
  const [playing, setPlaying] = useState(false);
  const [elapsed, setElapsed] = useState(0); // seconds, whole session
  const [voice, setVoice] = useState(true);
  const lastTick = useRef<number | null>(null);
  const spokenStep = useRef(-1);
  const canSpeak = typeof window !== "undefined" && "speechSynthesis" in window;

  // Which step are we in?
  let acc = 0;
  let index = steps.length - 1;
  for (let i = 0; i < steps.length; i++) {
    if (elapsed < acc + steps[i].seconds) {
      index = i;
      break;
    }
    acc += steps[i].seconds;
  }
  const step = steps[index];
  const complete = elapsed >= total;

  // Timestamp-based clock: accurate even if the tab throttles intervals.
  useEffect(() => {
    if (!playing || complete) {
      lastTick.current = null;
      return;
    }
    lastTick.current = performance.now();
    const t = setInterval(() => {
      const now = performance.now();
      const dt = (now - (lastTick.current ?? now)) / 1000;
      lastTick.current = now;
      setElapsed((e) => Math.min(total, e + dt));
    }, 250);
    return () => clearInterval(t);
  }, [playing, complete, total]);

  // Speak each cue once as its step begins.
  useEffect(() => {
    if (!canSpeak || !playing || !voice || complete || spokenStep.current === index) return;
    spokenStep.current = index;
    const synth = window.speechSynthesis;
    synth.cancel();
    const u = new SpeechSynthesisUtterance(step.cue);
    const v = pickVoice();
    if (v) u.voice = v;
    u.rate = 0.82;
    u.pitch = 0.95;
    u.volume = 0.9;
    synth.speak(u);
  }, [canSpeak, playing, voice, index, step.cue, complete]);

  useEffect(() => {
    if (!canSpeak) return;
    if (!playing || !voice) window.speechSynthesis.cancel();
    if (!voice) spokenStep.current = -1;
  }, [canSpeak, playing, voice]);

  useEffect(() => () => {
    if (typeof window !== "undefined" && "speechSynthesis" in window) window.speechSynthesis.cancel();
  }, []);

  const remaining = Math.max(0, Math.ceil(total - elapsed));
  const mm = Math.floor(remaining / 60);
  const ss = String(remaining % 60).padStart(2, "0");
  const inhale = elapsed % 10 < 4;

  function skip() {
    const next = steps.slice(0, index + 1).reduce((s, x) => s + x.seconds, 0);
    spokenStep.current = -1;
    setElapsed(Math.min(total, next));
  }

  if (complete) {
    return (
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={calm} className="flex flex-col items-center py-8 text-center">
        <div className="relative grid h-40 w-40 place-items-center">
          <span className="absolute inset-0 rounded-full bg-moss-soft" />
          <span className="absolute inset-8 rounded-full bg-moss" style={{ animation: "breathe 8s ease-in-out infinite" }} />
        </div>
        <div className="mt-8 font-display text-3xl">Well rested</div>
        <p className="mt-2 text-ink-soft">{minutes} minutes of stillness.</p>
        <Button size="lg" className="mt-8 w-full max-w-xs" onClick={() => onFinish(minutes)}>
          Done
        </Button>
      </motion.div>
    );
  }

  return (
    <div className="flex flex-col items-center pb-2 pt-4 text-center">
      <Ring value={elapsed / total} size={248} stroke={3} color="var(--sage)" track="var(--surface-2)">
        <motion.div
          className="h-[168px] w-[168px] rounded-full"
          style={{ background: "radial-gradient(circle at 35% 30%, #fbfaf6 0%, #dfe7e1 45%, #b9c9be 100%)" }}
          animate={playing ? { scale: [0.78, 1, 1, 0.78] } : { scale: 0.86 }}
          transition={playing ? { duration: 10, times: [0, 0.4, 0.5, 1], repeat: Infinity, ease: "easeInOut" } : calm}
        />
      </Ring>

      <div className="mt-6 h-5">
        <AnimatePresence mode="wait">
          <motion.div
            key={playing ? (inhale ? "in" : "out") : "paused"}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.6 }}
            className="eyebrow"
          >
            {playing ? (inhale ? "Breathe in" : "Breathe out") : elapsed > 0 ? "Paused" : `${minutes} minutes`}
          </motion.div>
        </AnimatePresence>
      </div>

      <div className="mt-4 min-h-[112px] max-w-sm">
        <AnimatePresence mode="wait">
          <motion.div key={index} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }} transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}>
            <div className="font-display text-2xl">{step.title}</div>
            <p className="mt-2 leading-relaxed text-ink-soft">{step.cue}</p>
          </motion.div>
        </AnimatePresence>
      </div>

      <div className="mt-6 flex w-full items-center justify-between">
        <IconButton
          icon={voice ? Volume2 : VolumeX}
          label={voice ? "Mute voice" : "Unmute voice"}
          onClick={() => setVoice((v) => !v)}
          disabled={!canSpeak}
        />
        <motion.button
          type="button"
          aria-label={playing ? "Pause" : "Play"}
          onClick={() => setPlaying((p) => !p)}
          whileTap={{ scale: 0.92 }}
          transition={calm}
          className="grid h-16 w-16 place-items-center rounded-full bg-moss text-white shadow-[0_10px_30px_-10px_rgba(61,90,79,0.8)]"
        >
          {playing ? <Pause className="h-6 w-6" strokeWidth={1.8} /> : <Play className="ml-0.5 h-6 w-6" strokeWidth={1.8} />}
        </motion.button>
        <IconButton icon={SkipForward} label="Next step" onClick={skip} />
      </div>

      <div className="mt-6 flex w-full items-center justify-between text-sm text-ink-faint">
        <span className="tabular-nums">
          {mm}:{ss} left
        </span>
        {elapsed >= 60 ? (
          <button type="button" onClick={() => onFinish(Math.round(elapsed / 60))} className="font-medium hover:text-ink">
            End &amp; save
          </button>
        ) : (
          <span>
            {index + 1} / {steps.length}
          </span>
        )}
      </div>
    </div>
  );
}
