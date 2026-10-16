"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { useMotionActivity } from "@/components/characters/player";
import { cn } from "@/lib/utils";

const CYCLE_SECONDS = 10;
const INHALE_SECONDS = 4;
const wrap = (seconds: number) => ((seconds % CYCLE_SECONDS) + CYCLE_SECONDS) % CYCLE_SECONDS;

/** An airy breathing bloom, beside its cue and below the people rather than over them. */
export function BreathingGuide({
  cycle, playing = true, active = true, className,
}: {
  /** Guided-session time in seconds. Omit for a local clock that keeps its position when paused. */
  cycle?: number;
  playing?: boolean;
  active?: boolean;
  className?: string;
}) {
  const host = useRef<HTMLDivElement>(null);
  const bloom = useRef<SVGGElement>(null);
  const breathArc = useRef<SVGCircleElement>(null);
  const elapsed = useRef(0);
  const previousInhale = useRef(true);
  const [localInhale, setLocalInhale] = useState(true);
  const { reduced, running } = useMotionActivity(host, active);
  const controlled = cycle !== undefined;
  const inhale = controlled ? wrap(cycle) < INHALE_SECONDS : localInhale;

  // Only this small SVG changes each frame; the page and character stage do not re-render.
  const draw = useCallback((seconds: number) => {
    const phase = wrap(seconds);
    const breathingIn = phase < INHALE_SECONDS;
    const progress = breathingIn ? phase / INHALE_SECONDS : (phase - INHALE_SECONDS) / 6;
    const eased = (1 - Math.cos(Math.PI * progress)) / 2;
    const fullness = reduced ? 0.5 : breathingIn ? eased : 1 - eased;
    bloom.current?.setAttribute("transform", `scale(${0.7 + fullness * 0.3})`);
    breathArc.current?.setAttribute("stroke-dasharray", `${1 + fullness * 8} 10`);
  }, [reduced]);

  // External session ticks correct the clock, including a deliberate jump to the next step.
  useEffect(() => {
    if (cycle === undefined) return;
    elapsed.current = wrap(cycle);
    draw(elapsed.current);
  }, [cycle, draw]);

  useEffect(() => {
    if (!running || !playing) {
      draw(elapsed.current);
      return;
    }
    let frame = 0;
    let last: number | undefined;
    const tick = (now: number) => {
      if (last !== undefined) elapsed.current = wrap(elapsed.current + (now - last) / 1000);
      last = now;
      draw(elapsed.current);
      const nextInhale = elapsed.current < INHALE_SECONDS;
      if (!controlled && nextInhale !== previousInhale.current) {
        previousInhale.current = nextInhale;
        setLocalInhale(nextInhale);
      }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [controlled, draw, playing, running]);

  return (
    <div
      ref={host}
      className={cn("flex min-h-[88px] min-w-0 items-center justify-center gap-4 px-4", className)}
      role="group"
      aria-label="Breathing guide: breathe in for four seconds, then breathe out for six seconds."
      data-breath-phase={inhale ? "in" : "out"}
      data-breath-playing={playing && running}
    >
      <svg viewBox="0 0 88 88" className="h-[84px] w-[84px] shrink-0 overflow-visible" aria-hidden focusable="false">
        <circle cx="44" cy="44" r="38" fill="none" stroke="var(--sage)" strokeWidth="0.8" opacity="0.24" />
        <circle
          ref={breathArc}
          cx="44" cy="44" r="38" pathLength="10"
          fill="none" stroke="var(--moss)" strokeWidth="1.2" strokeLinecap="round"
          strokeDasharray="1 10" transform="rotate(-90 44 44)" opacity="0.55"
        />
        <g transform="translate(44 44)">
          <g ref={bloom} transform="scale(.7)" fill="none" strokeLinecap="round" strokeLinejoin="round">
            <path d="M0 24 C-18 18 -25 5 -18 -10 C-12 -22 -3 -26 0 -30 C3 -26 12 -22 18 -10 C25 5 18 18 0 24Z" stroke="var(--sage)" strokeWidth="1.2" opacity="0.9" />
            <path d="M0 24 C-22 21 -32 11 -30 -4 C-20 -8 -7 -4 0 9 C7 -4 20 -8 30 -4 C32 11 22 21 0 24Z" stroke="var(--moss)" strokeWidth="1.15" opacity="0.7" />
            <path d="M-12 14 C-7 10 -3 5 0 -4 C3 5 7 10 12 14" stroke="var(--clay)" strokeWidth="1.1" opacity="0.8" />
          </g>
        </g>
      </svg>
      <div className="min-w-0 text-left">
        <div className="font-display text-2xl leading-tight text-moss">{inhale ? "Breathe in" : "Breathe out"}</div>
        <div className="mt-1 text-xs tracking-wide text-ink-soft">
          {!playing ? "Paused · " : ""}{inhale ? "4 seconds" : "6 seconds"}
        </div>
        <div className="mt-2 flex items-center gap-2 text-[10px] uppercase tracking-[0.14em] text-ink-faint" aria-hidden>
          <span className={inhale ? "text-moss" : undefined}>In · 4</span>
          <span className="h-px w-4 bg-sage/40" />
          <span className={!inhale ? "text-moss" : undefined}>Out · 6</span>
        </div>
      </div>
    </div>
  );
}
