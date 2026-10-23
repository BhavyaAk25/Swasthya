"use client";

import { AnimatePresence, motion } from "framer-motion";
import { Pause, Play, SkipForward, Volume2, VolumeX } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { useApp } from "@/components/app";
import { LiveVoice } from "@/components/overlays/live-voice";
import { RestoreScene } from "@/components/three";
import { Bar, Button, calm, IconButton, Sheet } from "@/components/ui";
import { BreathingTide } from "@/components/visuals";
import { stepsFor } from "@/lib/recovery";
import { actions } from "@/lib/store";
import { cancelVoice, prefetchVoice, say, voiceSupported } from "@/lib/voice";
import { FIXED, nidraParts } from "@/lib/voice-phrases";
import { stageStyle } from "@/lib/stages";

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
  // Seconds actually spent playing (skips don't count), so closing early still saves honest minutes.
  const played = useRef(0);
  useEffect(() => {
    if (open) played.current = 0;
  }, [open]);

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
  const close = useCallback(() => (live ? onClose() : finish(Math.floor(played.current / 60), "guided")), [live, onClose, finish]);

  return (
    <Sheet open={open} onClose={close} title={live ? "Live reset" : "Yoga nidra"}>
      {live ? (
        <LiveVoice name={profile.name} goal={profile.goal} onEnd={(m) => finish(m, "live")} />
      ) : (
        <Guided minutes={minutes} played={played} onFinish={() => finish(Math.round(played.current / 60), "guided")} />
      )}
    </Sheet>
  );
}

function Guided({ minutes, played, onFinish }: { minutes: number; played: React.RefObject<number>; onFinish: () => void }) {
  const steps = useMemo(() => stepsFor(minutes), [minutes]);
  const total = steps.reduce((s, x) => s + x.seconds, 0);
  const [playing, setPlaying] = useState(false);
  const [elapsed, setElapsed] = useState(0); // seconds, whole session
  const [voice, setVoice] = useState(true);
  const lastTick = useRef<number | null>(null);
  const spokenStep = useRef(-1);
  const [canSpeak] = useState(voiceSupported);

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
      played.current += dt;
      setElapsed((e) => Math.min(total, e + dt));
    }, 250);
    return () => clearInterval(t);
  }, [playing, complete, total, played]);

  // Warm every recorded cue so the voice starts without a network pause.
  useEffect(() => {
    prefetchVoice([...steps.flatMap((s) => nidraParts(s.cue)), FIXED.rested]);
  }, [steps]);

  // Speak each cue once as its step begins: one sentence at a time, with unhurried pauses.
  useEffect(() => {
    if (!canSpeak || !playing || !voice || complete || spokenStep.current === index) return;
    spokenStep.current = index;
    void say(nidraParts(step.cue), { gap: 1.4, volume: 0.9, fallbackRate: 0.82 });
  }, [canSpeak, playing, voice, index, step.cue, complete]);

  // A soft closing line when the session ends.
  useEffect(() => {
    if (complete && canSpeak && voice) void say([FIXED.rested], { volume: 0.9, fallbackRate: 0.82 });
  }, [complete, canSpeak, voice]);

  useEffect(() => {
    if (!playing || !voice) cancelVoice();
    if (!voice) spokenStep.current = -1;
  }, [playing, voice]);

  useEffect(() => () => cancelVoice(), []);

  const remaining = Math.max(0, Math.ceil(total - elapsed));
  const mm = Math.floor(remaining / 60);
  const ss = String(remaining % 60).padStart(2, "0");

  function skip() {
    const next = steps.slice(0, index + 1).reduce((s, x) => s + x.seconds, 0);
    spokenStep.current = -1;
    setElapsed(Math.min(total, next));
  }

  if (complete) {
    return (
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={calm} className="flex flex-col items-center py-8 text-center">
        <div className="h-40 w-40"><BreathingTide level={0.5} /></div>
        <div className="mt-8 font-display text-3xl">Well rested</div>
        <p className="mt-2 text-ink-soft">Take your time getting up.</p>
        <Button size="lg" className="mt-8 w-full max-w-xs" onClick={onFinish}>
          Done
        </Button>
      </motion.div>
    );
  }

  return (
    <div className="flex flex-col items-center pb-2 pt-1 text-center">
      <div data-stage="dusk" style={stageStyle("dusk")} className="relative w-full overflow-hidden rounded-[24px] border border-line">
        <RestoreScene cycle={elapsed % 10} playing={playing} className="h-[300px] w-full sm:h-[340px]" />
      </div>
      <div className="mt-4 w-full">
        <Bar value={elapsed / total} color="var(--sage)" />
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
          <button type="button" onClick={onFinish} className="font-medium hover:text-ink">
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
