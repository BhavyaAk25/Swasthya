"use client";

import { AnimatePresence, motion } from "framer-motion";
import { ArrowLeft, ArrowRight, Check } from "lucide-react";
import { useState } from "react";

import { Button, calm, ImageSlot } from "@/components/ui";
import { targetsFor } from "@/lib/foods";
import { IMAGES } from "@/lib/images";
import { SPLITS } from "@/lib/plan";
import { actions } from "@/lib/store";
import type { Goal, Split } from "@/lib/types";
import { cn, formatTime } from "@/lib/utils";

const GOALS: { id: Goal; label: string; hint: string }[] = [
  { id: "consistency", label: "Consistency", hint: "Show up, gently, every day" },
  { id: "strength", label: "Strength", hint: "Train with clear progress" },
  { id: "recovery", label: "Recovery", hint: "Rest deeper, stress less" },
];

const TIMES = ["20:30", "21:00", "21:30", "22:00", "22:30"];

function Option({ active, label, hint, onClick }: { active: boolean; label: string; hint: string; onClick: () => void }) {
  return (
    <motion.button
      type="button"
      onClick={onClick}
      whileTap={{ scale: 0.985 }}
      transition={calm}
      aria-pressed={active}
      className={cn(
        "flex w-full items-center justify-between gap-4 rounded-[22px] border px-5 py-4 text-left",
        active ? "border-moss bg-moss-soft/60" : "border-line bg-surface hover:border-[rgba(29,39,35,0.16)]",
      )}
    >
      <div>
        <div className="text-[15px] font-semibold">{label}</div>
        <div className="mt-0.5 text-sm text-ink-soft">{hint}</div>
      </div>
      <span
        className={cn(
          "grid h-6 w-6 shrink-0 place-items-center rounded-full border",
          active ? "border-moss bg-moss text-white" : "border-line",
        )}
      >
        <AnimatePresence>
          {active ? (
            <motion.span initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }} transition={calm}>
              <Check className="h-3.5 w-3.5" strokeWidth={2.5} />
            </motion.span>
          ) : null}
        </AnimatePresence>
      </span>
    </motion.button>
  );
}

export function Onboarding() {
  const [step, setStep] = useState(0);
  const [dir, setDir] = useState(1);
  const [name, setName] = useState("");
  const [goal, setGoal] = useState<Goal>("consistency");
  const [split, setSplit] = useState<Split>("three-day");
  const [time, setTime] = useState("21:30");

  const STEP_COUNT = 4;
  const valid = [name.trim().length > 0, true, true, /^\d{2}:\d{2}$/.test(time)][step];
  const last = step === STEP_COUNT - 1;

  function next() {
    if (!valid) return;
    if (last) {
      actions.saveProfile({
        name: name.trim(),
        goal,
        split,
        recoveryTime: time,
        ...targetsFor(goal),
        createdAt: new Date().toISOString(),
      });
      return;
    }
    setDir(1);
    setStep((s) => s + 1);
  }

  function back() {
    setDir(-1);
    setStep((s) => Math.max(0, s - 1));
  }

  const steps = [
    {
      title: "Welcome to a calmer routine.",
      body: (
        <div className="space-y-6">
          <p className="max-w-sm text-ink-soft">Eat well, move daily, rest deeply. One gentle coach for all three.</p>
          <label className="block">
            <span className="eyebrow">Your name</span>
            <input
              autoFocus
              value={name}
              maxLength={40}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && name.trim() && next()}
              placeholder="What should we call you?"
              className="mt-3 h-14 w-full rounded-[20px] border border-line bg-surface px-5 text-lg outline-none placeholder:text-ink-faint focus:border-sage"
            />
          </label>
        </div>
      ),
    },
    {
      title: "What matters most?",
      body: (
        <div className="space-y-3">
          {GOALS.map((g) => (
            <Option key={g.id} active={goal === g.id} label={g.label} hint={g.hint} onClick={() => setGoal(g.id)} />
          ))}
        </div>
      ),
    },
    {
      title: "Pick a rhythm.",
      body: (
        <div className="space-y-3">
          {SPLITS.map((s) => (
            <Option key={s.id} active={split === s.id} label={s.label} hint={s.hint} onClick={() => setSplit(s.id)} />
          ))}
        </div>
      ),
    },
    {
      title: "When do you wind down?",
      body: (
        <div className="space-y-5">
          <p className="text-ink-soft">We&apos;ll invite you to a short reset at this time.</p>
          <div className="flex flex-wrap gap-2">
            {TIMES.map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setTime(t)}
                className={cn(
                  "h-12 rounded-full border px-5 text-[15px] font-medium",
                  time === t ? "border-transparent bg-moss text-white" : "border-line bg-surface text-ink-soft hover:text-ink",
                )}
              >
                {formatTime(t)}
              </button>
            ))}
          </div>
          <label className="flex items-center gap-3 text-sm text-ink-soft">
            Or exactly
            <input
              type="time"
              value={time}
              onChange={(e) => e.target.value && setTime(e.target.value)}
              className="h-11 rounded-full border border-line bg-surface px-4 text-ink outline-none focus:border-sage"
            />
          </label>
        </div>
      ),
    },
  ];

  const current = steps[step];

  return (
    <div className="grid min-h-dvh lg:grid-cols-[1.05fr_1fr]">
      <div className="relative hidden p-4 lg:block">
        <ImageSlot src={IMAGES.welcome} tone="sage" label="Image" className="sticky top-4 h-[calc(100dvh-2rem)]">
          <div className="flex h-full flex-col justify-end p-10">
            <div className="font-display text-5xl font-light leading-[1.05] text-ink/80">
              Breathe.
              <br />
              Move.
              <br />
              Nourish.
            </div>
          </div>
        </ImageSlot>
      </div>

      <div className="flex flex-col px-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-[max(1.5rem,env(safe-area-inset-top))] sm:px-12 lg:px-16">
        <div className="flex items-center justify-between">
          <span className="font-display text-[22px]">swasthya</span>
          <div className="flex gap-1.5">
            {steps.map((_, i) => (
              <motion.span
                key={i}
                animate={{ width: i === step ? 22 : 6, opacity: i <= step ? 1 : 0.35 }}
                transition={calm}
                className="h-1.5 rounded-full bg-moss"
              />
            ))}
          </div>
        </div>

        <ImageSlot src={IMAGES.welcome} tone="sage" className="mt-6 h-40 sm:h-56 lg:hidden" />

        <div className="relative flex flex-1 flex-col justify-center py-10">
          <AnimatePresence mode="wait" custom={dir} initial={false}>
            <motion.div
              key={step}
              custom={dir}
              initial={{ opacity: 0, x: dir * 24 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: dir * -16 }}
              transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
              className="mx-auto w-full max-w-md"
            >
              <h1 className="font-display text-4xl font-light leading-[1.1] sm:text-5xl">{current.title}</h1>
              <div className="mt-8">{current.body}</div>
            </motion.div>
          </AnimatePresence>
        </div>

        <div className="mx-auto flex w-full max-w-md items-center gap-3">
          <AnimatePresence initial={false}>
            {step > 0 ? (
              <motion.div initial={{ opacity: 0, width: 0 }} animate={{ opacity: 1, width: "auto" }} exit={{ opacity: 0, width: 0 }} transition={calm}>
                <Button variant="outline" size="icon" onClick={back} aria-label="Back">
                  <ArrowLeft className="h-4 w-4" />
                </Button>
              </motion.div>
            ) : null}
          </AnimatePresence>
          <Button size="lg" className="flex-1" onClick={next} disabled={!valid}>
            {last ? "Begin" : "Continue"}
            <ArrowRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
