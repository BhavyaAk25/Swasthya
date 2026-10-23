"use client";

import { AnimatePresence, LayoutGroup, motion } from "framer-motion";
import { Check } from "lucide-react";
import { useId } from "react";

import { useApp } from "@/components/app";
import { calm, Card, fade } from "@/components/ui";
import { actions, checkInFor } from "@/lib/store";
import type { CheckIn, Mood } from "@/lib/types";
import { cn, haptic } from "@/lib/utils";

const GLASSES = 8;
const SLEEP_OPTIONS = [5, 6, 7, 8, 9] as const;
const MOODS: Mood[] = [1, 2, 3, 4, 5];

/** A gentle, proactive suggestion from today's check-in, or null when nothing stands out. */
export function checkInHint(c: CheckIn): { tone: "rest" | "light"; text: string } | null {
  if (c.sleep !== undefined && c.sleep < 6) return { tone: "light", text: "Short sleep. Keep training light today." };
  if (c.mood !== undefined && c.mood <= 2) return { tone: "rest", text: "Low day. A short reset might help." };
  return null;
}

export function CheckInCard({ className }: { className?: string }) {
  const { data } = useApp();
  const c = checkInFor(data);
  const complete = c.water > 0 && c.sleep !== undefined && c.mood !== undefined;

  return (
    <Card className={className}>
      <div className="flex h-6 items-center justify-between">
        <div className="eyebrow">Check in</div>
        <AnimatePresence initial={false}>
          {complete ? (
            <motion.span
              key="done"
              initial={{ opacity: 0, scale: 0.85 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              transition={calm}
              className="grid h-6 w-6 place-items-center rounded-full bg-moss-soft text-moss"
              role="status"
              aria-label="Check-in complete"
            >
              <Check className="h-3.5 w-3.5" strokeWidth={2.4} />
            </motion.span>
          ) : null}
        </AnimatePresence>
      </div>

      <div className="mt-5 space-y-6">
        <Row label="Water" value={`${c.water} / ${GLASSES}`}>
          <Water value={c.water} />
        </Row>
        <Row label="Sleep" value={c.sleep !== undefined ? `${c.sleep >= 9 ? "9+" : c.sleep} h` : undefined}>
          <Sleep value={c.sleep} />
        </Row>
        <Row label="Mood">
          <MoodPicker value={c.mood} />
        </Row>
      </div>
    </Card>
  );
}

function Row({ label, value, children }: { label: string; value?: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="flex items-baseline justify-between text-xs">
        <span className="font-medium text-ink-soft">{label}</span>
        <AnimatePresence mode="popLayout" initial={false}>
          {value ? (
            <motion.span
              key={value}
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={fade}
              className="tabular-nums text-ink-faint"
            >
              {value}
            </motion.span>
          ) : null}
        </AnimatePresence>
      </div>
      <div className="mt-2.5">{children}</div>
    </div>
  );
}

/* ---------- water ---------- */

function Water({ value }: { value: number }) {
  return (
    <div className="flex items-end justify-between gap-1" role="group" aria-label="Glasses of water">
      {Array.from({ length: GLASSES }, (_, i) => {
        const n = i + 1;
        const filled = n <= value;
        return (
          <motion.button
            key={n}
            type="button"
            whileTap={{ scale: 0.9 }}
            transition={calm}
            aria-label={`${n} ${n === 1 ? "glass" : "glasses"} of water`}
            aria-pressed={filled}
            onClick={() => { haptic(); actions.setCheckIn({ water: n === value ? n - 1 : n }); }}
            className="grid h-12 min-w-0 max-w-11 flex-1 place-items-center rounded-2xl hover:bg-surface-2/70"
          >
            <Glass filled={filled} delay={filled ? Math.max(0, i - (value - 1)) * 0.04 : 0} />
          </motion.button>
        );
      })}
    </div>
  );
}

function Glass({ filled, delay }: { filled: boolean; delay: number }) {
  const raw = useId();
  const id = `glass-${raw.replace(/[^a-zA-Z0-9_-]/g, "")}`;
  // Inner shape of a slightly tapered tumbler.
  const shape = "M5.2 5 H18.8 L17.3 27.2 Q17.2 28.5 15.9 28.5 H8.1 Q6.8 28.5 6.7 27.2 Z";
  return (
    <svg viewBox="0 0 24 32" className="h-8 w-6" aria-hidden="true">
      <defs>
        <clipPath id={id}>
          <path d={shape} />
        </clipPath>
        <linearGradient id={`${id}-l`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#c9dcdc" />
          <stop offset="1" stopColor="#a7c2bd" />
        </linearGradient>
      </defs>
      <g clipPath={`url(#${id})`}>
        <motion.rect
          x="0"
          width="24"
          fill={`url(#${id}-l)`}
          initial={false}
          animate={{ y: filled ? 9 : 29, height: filled ? 20 : 0 }}
          transition={{ ...calm, delay }}
        />
        <motion.rect
          x="0"
          width="24"
          height="1.2"
          fill="#ffffff"
          initial={false}
          animate={{ y: filled ? 9 : 29, opacity: filled ? 0.7 : 0 }}
          transition={{ ...calm, delay }}
        />
      </g>
      <path
        d={shape}
        fill="none"
        stroke={filled ? "#8fadaa" : "var(--ink-faint)"}
        strokeOpacity={filled ? 1 : 0.55}
        strokeWidth="1.4"
        strokeLinejoin="round"
        style={{ transition: "stroke 0.35s ease, stroke-opacity 0.35s ease" }}
      />
    </svg>
  );
}

/* ---------- sleep ---------- */

function Sleep({ value }: { value: number | undefined }) {
  const group = useId();
  const active = (h: number) => value !== undefined && (h === 9 ? value >= 9 : Math.round(value) === h);
  return (
    <LayoutGroup id={`sleep-${group}`}>
      <div className="flex rounded-full bg-surface-2 p-1" role="group" aria-label="Hours of sleep">
        {SLEEP_OPTIONS.map((h) => {
          const on = active(h);
          return (
            <button
              key={h}
              type="button"
              aria-pressed={on}
              aria-label={h === 9 ? "9 or more hours" : `${h} hours`}
              onClick={() => { haptic(); actions.setCheckIn({ sleep: on ? undefined : h }); }}
              className={cn(
                "relative h-9 min-w-0 flex-1 rounded-full text-[13px] font-medium tabular-nums",
                on ? "text-ink" : "text-ink-soft hover:text-ink",
              )}
            >
              {on ? (
                <motion.span
                  layoutId="sleep-pill"
                  transition={calm}
                  className="absolute inset-0 rounded-full bg-surface shadow-[0_1px_2px_rgba(29,39,35,0.08),0_4px_12px_-6px_rgba(29,39,35,0.18)]"
                />
              ) : null}
              <span className="relative">{h === 9 ? "9+" : h}</span>
            </button>
          );
        })}
      </div>
    </LayoutGroup>
  );
}

/* ---------- mood ---------- */

/** Minimal stroked face; mouth curves from a frown (1) to a smile (5). */
export function MoodFace({ mood, className, active }: { mood: Mood; className?: string; active?: boolean }) {
  const curve = (mood - 3) * 2.2; // -4.4 .. 4.4
  const y = 17.6 - curve * 0.35;
  return (
    <svg viewBox="0 0 28 28" className={cn("h-7 w-7", className)} aria-hidden="true">
      <g
        fill="none"
        stroke={active ? "var(--moss)" : "currentColor"}
        strokeWidth="1.5"
        strokeLinecap="round"
        style={{ transition: "stroke 0.35s ease" }}
      >
        <circle cx="14" cy="14" r="11.25" strokeOpacity={active ? 0.9 : 0.5} />
        <path d={`M9.2 ${y} Q14 ${y + curve} 18.8 ${y}`} />
      </g>
      <g fill={active ? "var(--moss)" : "currentColor"}>
        <circle cx="10.2" cy="11.6" r="1.05" />
        <circle cx="17.8" cy="11.6" r="1.05" />
      </g>
    </svg>
  );
}

function MoodPicker({ value }: { value: Mood | undefined }) {
  const group = useId();
  return (
    <LayoutGroup id={`mood-${group}`}>
      <div className="flex justify-between gap-1" role="group" aria-label="Mood">
        {MOODS.map((m) => {
          const on = value === m;
          return (
            <motion.button
              key={m}
              type="button"
              whileTap={{ scale: 0.92 }}
              transition={calm}
              aria-label={`Mood ${m} of 5`}
              aria-pressed={on}
              onClick={() => { haptic(); actions.setCheckIn({ mood: on ? undefined : m }); }}
              className={cn(
                "relative grid h-12 min-w-0 max-w-14 flex-1 place-items-center rounded-full",
                on ? "text-moss" : "text-ink-faint hover:text-ink-soft",
              )}
            >
              {on ? (
                <motion.span layoutId="mood-pill" transition={calm} className="absolute inset-0 rounded-full bg-moss-soft" />
              ) : null}
              <MoodFace mood={m} active={on} className="relative" />
            </motion.button>
          );
        })}
      </div>
    </LayoutGroup>
  );
}
