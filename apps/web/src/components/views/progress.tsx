"use client";

import { animate, AnimatePresence, motion, useMotionValue, useTransform } from "framer-motion";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import { useEffect, useId, useMemo, useState } from "react";

import { useApp } from "@/components/app";
import { MoodFace } from "@/components/checkin";
import { calm, Card, fade, IconButton } from "@/components/ui";
import { streak, totalsFor } from "@/lib/store";
import type { AppData, CheckIn } from "@/lib/types";
import { addDays, cn, dateKey, lastNDays, weekdayShort } from "@/lib/utils";

/* ---------- palette (brand) ---------- */

const ATE = "var(--clay)";
const MOVED = "var(--moss)";
const RESTED = "#b5a5bb";
const grow = { duration: 0.9, ease: [0.22, 1, 0.36, 1] as const };

const num = new Intl.NumberFormat();
const fmt = (n: number) => num.format(Math.round(n));

/* ---------- date helpers (local time only) ---------- */

function parseKey(key: string) {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(y, m - 1, d);
}

function startOfWeek(date: Date) {
  return addDays(date, -((date.getDay() + 6) % 7)); // Monday
}

const shortDate = (key: string) =>
  new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric" }).format(parseKey(key));
const numericDate = (key: string) =>
  new Intl.DateTimeFormat(undefined, { month: "numeric", day: "numeric" }).format(parseKey(key));
const longDay = (key: string) =>
  new Intl.DateTimeFormat(undefined, { weekday: "long", month: "long", day: "numeric" }).format(parseKey(key));
const weekdayLong = (key: string) => new Intl.DateTimeFormat(undefined, { weekday: "long" }).format(parseKey(key));

type Totals = ReturnType<typeof totalsFor>;
const isActive = (t: Totals) => t.calories > 0 || t.workout || t.recovered;
const pillars = (t: Totals) => Number(t.calories > 0) + Number(t.workout) + Number(t.recovered);

/* ---------- view ---------- */

export function ProgressView() {
  const { data } = useApp();
  const calorieTarget = data.profile?.calorieTarget ?? 2000;
  const proteinTarget = data.profile?.proteinTarget ?? 100;

  const m = useMemo(() => compute(data), [data]);

  return (
    <div className="space-y-6 lg:space-y-8">
      <header>
        <div className="eyebrow">Progress</div>
        <h1 className="mt-2 font-display text-4xl font-light sm:text-5xl">Your rhythm</h1>
      </header>

      <div className="grid grid-cols-2 gap-3 [&>*]:min-w-0 sm:gap-4 lg:grid-cols-4 lg:gap-6">
        <StatTile label="Streak" value={m.streak} unit={m.streak === 1 ? "day" : "days"} />
        <StatTile label="This month" value={m.activeThisMonth} unit="active" />
        <StatTile label="This week" value={m.workoutsThisWeek} unit={m.workoutsThisWeek === 1 ? "workout" : "workouts"} />
        <StatTile label="Rest, 7 days" value={m.restLast7} unit="min" />
      </div>

      <div className="grid gap-4 [&>*]:min-w-0 lg:grid-cols-[1.35fr_1fr] lg:gap-6">
        <MonthCalendar data={data} />
        <WeeklyReview data={data} />
      </div>

      <div className="grid gap-4 [&>*]:min-w-0 lg:grid-cols-2 lg:gap-6">
        <DailyBars
          title="Calories"
          unit="kcal"
          days={m.days14}
          values={m.days14.map((d) => d.totals.calories)}
          target={calorieTarget}
          today={MOVED}
          other="var(--sage)"
        />
        <DailyBars
          title="Protein"
          unit="g"
          days={m.days14}
          values={m.days14.map((d) => d.totals.protein)}
          target={proteinTarget}
          today={ATE}
          other="#dcc0a5"
        />
        <SleepMood days={m.days14} />
        <WeeklyBars weeks={m.weeks} />
      </div>
    </div>
  );
}

function compute(data: AppData) {
  const now = new Date();
  const todayKey = dateKey(now);

  let activeThisMonth = 0;
  for (let d = 1; d <= now.getDate(); d++) {
    if (isActive(totalsFor(data, dateKey(new Date(now.getFullYear(), now.getMonth(), d))))) activeThisMonth++;
  }

  const weekStart = dateKey(startOfWeek(now));
  const workoutsThisWeek = Object.values(data.workouts).filter(
    (w) => w.status === "done" && w.date >= weekStart && w.date <= todayKey,
  ).length;

  const last7 = new Set(lastNDays(7, now));
  const restLast7 = data.recovery.filter((r) => last7.has(r.date)).reduce((s, r) => s + r.minutes, 0);

  const days14 = lastNDays(14, now).map((key) => ({ key, totals: totalsFor(data, key), today: key === todayKey }));

  const monday = startOfWeek(now);
  const weeks = Array.from({ length: 8 }, (_, i) => {
    const start = addDays(monday, -7 * (7 - i));
    const keys = Array.from({ length: 7 }, (_, j) => dateKey(addDays(start, j)));
    const set = new Set(keys);
    return {
      key: keys[0],
      current: i === 7,
      workouts: keys.filter((k) => data.workouts[k]?.status === "done").length,
      rest: data.recovery.filter((r) => set.has(r.date)).reduce((s, r) => s + r.minutes, 0),
    };
  });

  return { streak: streak(data), activeThisMonth, workoutsThisWeek, restLast7, days14, weeks };
}

/* ---------- stat tile ---------- */

function CountUp({ value }: { value: number }) {
  const mv = useMotionValue(0);
  const shown = useTransform(mv, (v) => fmt(v));
  useEffect(() => {
    const controls = animate(mv, value, { duration: 1, ease: [0.22, 1, 0.36, 1] });
    return () => controls.stop();
  }, [mv, value]);
  return <motion.span>{shown}</motion.span>;
}

function StatTile({ label, value, unit }: { label: string; value: number; unit?: string }) {
  return (
    <Card initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={calm} className="p-5">
      <div className="eyebrow truncate">{label}</div>
      <div className="mt-3 flex items-baseline gap-1.5">
        <span className="font-display text-4xl font-light tabular-nums sm:text-[44px]" aria-hidden="true">
          <CountUp value={value} />
        </span>
        <span className="sr-only">{value}</span>
        {unit ? <span className="truncate text-sm text-ink-faint">{unit}</span> : null}
      </div>
    </Card>
  );
}

/* ---------- month calendar ---------- */

const MONDAY = new Date(2024, 0, 1); // a known Monday, for weekday initials
const WEEKDAYS = Array.from({ length: 7 }, (_, i) => weekdayShort(dateKey(addDays(MONDAY, i))));

const monthSlide = {
  enter: (d: number) => ({ opacity: 0, x: d * 28 }),
  center: { opacity: 1, x: 0 },
  exit: (d: number) => ({ opacity: 0, x: d * -28 }),
};
const titleSlide = {
  enter: (d: number) => ({ opacity: 0, y: d * 6 }),
  center: { opacity: 1, y: 0 },
  exit: (d: number) => ({ opacity: 0, y: d * -6 }),
};

function MonthCalendar({ data }: { data: AppData }) {
  const [[offset, dir], setOffset] = useState<[number, number]>([0, 0]);
  const [selected, setSelected] = useState<string | null>(null);

  const now = new Date();
  const todayKey = dateKey(now);
  const first = new Date(now.getFullYear(), now.getMonth() + offset, 1);
  const monthKey = dateKey(first).slice(0, 7);
  const daysInMonth = new Date(first.getFullYear(), first.getMonth() + 1, 0).getDate();
  const lead = (first.getDay() + 6) % 7;
  const monthLabel = new Intl.DateTimeFormat(undefined, { month: "long" }).format(first);
  const year = first.getFullYear();

  const cells = Array.from({ length: 42 }, (_, i) => {
    const day = i - lead + 1;
    if (day < 1 || day > daysInMonth) return null;
    const key = dateKey(new Date(first.getFullYear(), first.getMonth(), day));
    return { day, key, totals: totalsFor(data, key) };
  });

  const shown = selected && selected.startsWith(monthKey) ? selected : null;

  function move(step: number) {
    const next = Math.max(-12, Math.min(0, offset + step));
    if (next === offset) return;
    setOffset([next, step]);
  }

  return (
    <Card>
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="eyebrow">Calendar</div>
          <div className="mt-1.5 flex items-baseline gap-2 overflow-hidden">
            <AnimatePresence mode="popLayout" initial={false} custom={dir}>
              <motion.h2
                key={monthKey}
                custom={dir}
                variants={titleSlide}
                initial="enter"
                animate="center"
                exit="exit"
                transition={fade}
                className="font-display text-2xl"
                aria-live="polite"
              >
                {monthLabel} <span className="text-ink-faint">{year}</span>
              </motion.h2>
            </AnimatePresence>
          </div>
        </div>
        <div className="-mr-2 flex shrink-0 items-center">
          <IconButton icon={ChevronLeft} label="Previous month" onClick={() => move(-1)} disabled={offset <= -12} className="disabled:opacity-30" />
          <IconButton icon={ChevronRight} label="Next month" onClick={() => move(1)} disabled={offset >= 0} className="disabled:opacity-30" />
        </div>
      </div>

      <div className="mt-5 grid grid-cols-7 gap-1 text-center" aria-hidden="true">
        {WEEKDAYS.map((w, i) => (
          <span key={i} className="text-[11px] font-medium text-ink-faint">
            {w}
          </span>
        ))}
      </div>

      <div className="relative mt-2 overflow-hidden">
        <AnimatePresence mode="popLayout" initial={false} custom={dir}>
          <motion.div
            key={monthKey}
            custom={dir}
            variants={monthSlide}
            initial="enter"
            animate="center"
            exit="exit"
            transition={calm}
            className="grid grid-cols-7 gap-1"
          >
            {cells.map((c, i) => {
              if (!c) return <div key={`e${i}`} className="h-12 sm:h-14" />;
              const future = c.key > todayKey;
              const isToday = c.key === todayKey;
              const has = isActive(c.totals) || !!c.totals.checkin;
              const on = shown === c.key;
              const marks = [c.totals.calories > 0, c.totals.workout, c.totals.recovered];
              const label = [
                longDay(c.key),
                c.totals.calories > 0 ? "ate" : null,
                c.totals.workout ? "moved" : null,
                c.totals.recovered ? "rested" : null,
              ]
                .filter(Boolean)
                .join(", ");
              const inner = (
                <>
                  <span className={cn("text-[13px] tabular-nums", isToday ? "font-semibold text-ink" : future ? "text-ink-faint/60" : "text-ink-soft")}>
                    {c.day}
                  </span>
                  <span className="flex h-1.5 items-center gap-[3px]">
                    {marks.map((hit, j) => (
                      <motion.span
                        key={j}
                        initial={false}
                        animate={{ opacity: hit ? 1 : 0, scale: hit ? 1 : 0.4 }}
                        transition={calm}
                        className="h-[5px] w-[5px] rounded-full"
                        style={{ background: [ATE, MOVED, RESTED][j] }}
                      />
                    ))}
                  </span>
                </>
              );
              const base = cn(
                "relative flex h-12 flex-col items-center justify-center gap-1 rounded-2xl sm:h-14",
                isToday && "ring-1 ring-inset ring-moss/60",
              );
              if (future || !has) {
                return (
                  <div key={c.key} className={base} aria-label={label} role="img">
                    {inner}
                  </div>
                );
              }
              return (
                <button
                  key={c.key}
                  type="button"
                  aria-label={label}
                  aria-pressed={on}
                  onClick={() => setSelected(on ? null : c.key)}
                  className={cn(base, on ? "bg-moss-soft" : "hover:bg-surface-2/70")}
                >
                  {inner}
                </button>
              );
            })}
          </motion.div>
        </AnimatePresence>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-ink-faint">
        <LegendDot color={ATE} label="Ate" />
        <LegendDot color={MOVED} label="Moved" />
        <LegendDot color={RESTED} label="Rested" />
      </div>

      <AnimatePresence initial={false}>
        {shown ? (
          <motion.div
            key="detail"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={calm}
            className="overflow-hidden"
          >
            <DayDetail dayKey={shown} totals={totalsFor(data, shown)} onClose={() => setSelected(null)} />
          </motion.div>
        ) : null}
      </AnimatePresence>
    </Card>
  );
}

function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className="h-[7px] w-[7px] rounded-full" style={{ background: color }} />
      {label}
    </span>
  );
}

function DayDetail({ dayKey, totals, onClose }: { dayKey: string; totals: Totals; onClose: () => void }) {
  const c = totals.checkin;
  const rows: [string, React.ReactNode][] = [
    ["Calories", totals.calories ? `${fmt(totals.calories)} kcal` : "—"],
    ["Protein", totals.protein ? `${fmt(totals.protein)} g` : "—"],
    ["Workout", totals.workout ? "Done" : "—"],
    ["Rest", totals.recoveryMinutes ? `${totals.recoveryMinutes} min` : "—"],
    ["Water", c?.water ? `${c.water} glasses` : "—"],
    ["Sleep", c?.sleep !== undefined ? `${c.sleep} h` : "—"],
    [
      "Mood",
      c?.mood ? (
        <span className="inline-flex items-center gap-1.5">
          <MoodFace mood={c.mood} className="h-5 w-5 text-ink-soft" />
          <span>{c.mood} / 5</span>
        </span>
      ) : (
        "—"
      ),
    ],
  ];
  return (
    <div className="pt-5">
      <div className="rounded-[22px] bg-bg p-4 sm:p-5">
        <div className="flex items-center justify-between gap-3">
          <AnimatePresence mode="popLayout" initial={false}>
            <motion.div
              key={dayKey}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={fade}
              className="truncate font-display text-lg"
            >
              {longDay(dayKey)}
            </motion.div>
          </AnimatePresence>
          <IconButton icon={X} label="Close day details" onClick={onClose} className="-my-2 -mr-2 h-9 w-9" />
        </div>
        <motion.dl
          key={dayKey}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={fade}
          className="mt-3 grid grid-cols-1 gap-x-6 [&>*]:min-w-0 sm:grid-cols-2"
        >
          {rows.map(([k, v]) => (
            <div key={k} className="flex items-baseline justify-between gap-3 border-b border-line py-2.5 text-sm">
              <dt className="text-ink-faint">{k}</dt>
              <dd className="min-w-0 truncate tabular-nums text-ink">{v}</dd>
            </div>
          ))}
        </motion.dl>
      </div>
    </div>
  );
}

/* ---------- weekly review ---------- */

function WeeklyReview({ data }: { data: AppData }) {
  const r = useMemo(() => {
    const days = lastNDays(7).map((key) => ({ key, t: totalsFor(data, key) }));
    const ate = days.filter((d) => d.t.calories > 0);
    const slept = days.map((d) => d.t.checkin?.sleep).filter((s): s is number => s !== undefined);
    const avg = (xs: number[]) => (xs.length ? xs.reduce((s, x) => s + x, 0) / xs.length : null);
    let best: { key: string; score: number; t: Totals } | null = null;
    for (const d of days) {
      const score = pillars(d.t);
      if (score > 0 && (!best || score >= best.score)) best = { key: d.key, score, t: d.t };
    }
    return {
      active: days.filter((d) => isActive(d.t)).length,
      workouts: days.filter((d) => d.t.workout).length,
      calories: avg(ate.map((d) => d.t.calories)),
      protein: avg(ate.map((d) => d.t.protein)),
      sleep: avg(slept),
      water: days.reduce((s, d) => s + (d.t.checkin?.water ?? 0), 0),
      best,
    };
  }, [data]);

  const rows: [string, React.ReactNode][] = [
    ["Active days", `${r.active} / 7`],
    ["Workouts", r.workouts],
    ["Avg calories", r.calories !== null ? `${fmt(r.calories)} kcal` : "—"],
    ["Avg protein", r.protein !== null ? `${fmt(r.protein)} g` : "—"],
    ["Avg sleep", r.sleep !== null ? `${r.sleep.toFixed(1)} h` : "—"],
    ["Water", `${r.water} glasses`],
  ];

  return (
    <Card className="flex flex-col">
      <div className="eyebrow">Last 7 days</div>
      <h2 className="mt-1.5 font-display text-2xl">Weekly review</h2>
      <dl className="mt-4">
        {rows.map(([k, v], i) => (
          <motion.div
            key={k}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ ...calm, delay: 0.05 + i * 0.04 }}
            className="flex items-baseline justify-between gap-4 border-b border-line py-3 text-sm"
          >
            <dt className="text-ink-soft">{k}</dt>
            <dd className="tabular-nums text-ink">{v}</dd>
          </motion.div>
        ))}
      </dl>
      <div className="mt-auto pt-5">
        <div className="rounded-[22px] bg-moss-soft/60 px-4 py-3.5">
          <div className="eyebrow">Best day</div>
          <div className="mt-1.5 flex items-center justify-between gap-3">
            <span className="truncate font-display text-xl">{r.best ? weekdayLong(r.best.key) : "—"}</span>
            {r.best ? (
              <span className="flex shrink-0 items-center gap-1.5" aria-label={`${r.best.score} of 3 pillars`}>
                {[r.best.t.calories > 0, r.best.t.workout, r.best.t.recovered].map((hit, j) => (
                  <span
                    key={j}
                    className="h-2 w-2 rounded-full"
                    style={{ background: hit ? [ATE, MOVED, RESTED][j] : "var(--line)" }}
                  />
                ))}
              </span>
            ) : null}
          </div>
        </div>
      </div>
    </Card>
  );
}

/* ---------- chart scaffolding ---------- */

/**
 * Pointer + keyboard scrubbing over `n` evenly spaced columns.
 * The whole column is the hit target; arrow keys move between columns.
 */
function useScrub(n: number) {
  const [active, setActive] = useState<number | null>(null);
  const pick = (e: React.PointerEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const i = Math.floor(((e.clientX - rect.left) / rect.width) * n);
    setActive(Math.max(0, Math.min(n - 1, i)));
  };
  const props = {
    tabIndex: 0,
    onPointerMove: pick,
    onPointerDown: pick,
    onPointerLeave: (e: React.PointerEvent) => e.pointerType === "mouse" && setActive(null),
    onFocus: () => setActive((a) => a ?? n - 1),
    onBlur: () => setActive(null),
    onKeyDown: (e: React.KeyboardEvent) => {
      const map: Record<string, number> = { ArrowLeft: -1, ArrowRight: 1 };
      if (e.key in map) {
        e.preventDefault();
        setActive((a) => Math.max(0, Math.min(n - 1, (a ?? n - 1) + map[e.key])));
      } else if (e.key === "Home") {
        e.preventDefault();
        setActive(0);
      } else if (e.key === "End") {
        e.preventDefault();
        setActive(n - 1);
      } else if (e.key === "Escape") {
        setActive(null);
      }
    },
    style: { touchAction: "pan-y" } as React.CSSProperties,
  };
  return { active, props };
}

function Tooltip({ index, n, children }: { index: number | null; n: number; children: React.ReactNode }) {
  const i = index ?? 0;
  const left = ((i + 0.5) / n) * 100;
  const shift = n > 1 ? (i / (n - 1)) * -100 : -50;
  return (
    <AnimatePresence>
      {index !== null ? (
        <motion.div
          key="tip"
          initial={{ opacity: 0, left: `${left}%`, x: `${shift}%`, y: 4 }}
          animate={{ opacity: 1, left: `${left}%`, x: `${shift}%`, y: 0 }}
          exit={{ opacity: 0, y: 4 }}
          transition={calm}
          className="pointer-events-none absolute top-0 z-20 whitespace-nowrap rounded-2xl border border-line bg-surface/95 px-3 py-2 text-xs shadow-[var(--shadow-sm)] backdrop-blur"
          aria-hidden="true"
        >
          {children}
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}

function ChartCard({
  title,
  aside,
  legend,
  summary,
  children,
}: {
  title: string;
  aside?: React.ReactNode;
  legend?: React.ReactNode;
  summary: string;
  children: React.ReactNode;
}) {
  const id = useId();
  return (
    <Card className="flex flex-col" role="figure" aria-labelledby={`${id}-t`} aria-describedby={`${id}-s`}>
      <div className="flex items-baseline justify-between gap-3">
        <h2 id={`${id}-t`} className="eyebrow">
          {title}
        </h2>
        {aside ? <div className="truncate text-xs tabular-nums text-ink-faint">{aside}</div> : null}
      </div>
      {legend ? <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-ink-faint">{legend}</div> : null}
      <p id={`${id}-s`} className="sr-only">
        {summary}
      </p>
      <div className="mt-auto pt-6">{children}</div>
    </Card>
  );
}

function TipValue({ value, label }: { value: React.ReactNode; label: React.ReactNode }) {
  return (
    <div className="flex items-baseline gap-2">
      <span className="font-semibold tabular-nums text-ink">{value}</span>
      <span className="text-ink-faint">{label}</span>
    </div>
  );
}

function AxisLabels({ labels, strong }: { labels: string[]; strong?: number }) {
  return (
    <div className="mt-2 flex" aria-hidden="true">
      {labels.map((l, i) => (
        <span
          key={i}
          className={cn(
            "min-w-0 flex-1 truncate text-center text-[10px] tabular-nums",
            i === strong ? "font-semibold text-ink-soft" : "text-ink-faint",
          )}
        >
          {l}
        </span>
      ))}
    </div>
  );
}

/** Columns grown from a shared baseline. Values are already in the chart's unit. */
function Columns({
  values,
  max,
  color,
  active,
  className,
}: {
  values: number[];
  max: number;
  color: (i: number) => string;
  active: number | null;
  className?: string;
}) {
  return (
    <div className={cn("absolute inset-0 flex items-end", className)}>
      {values.map((v, i) => {
        const pct = max > 0 ? (v / max) * 100 : 0;
        return (
          <div key={i} className="flex h-full min-w-0 flex-1 items-end justify-center px-[2px] sm:px-[3px]">
            {v > 0 ? (
              <motion.div
                className="w-full max-w-6 rounded-t-[4px]"
                style={{ background: color(i) }}
                initial={{ height: 0 }}
                animate={{ height: `${Math.max(2.5, Math.min(100, pct))}%`, opacity: active === null || active === i ? 1 : 0.45 }}
                transition={{ height: { ...grow, delay: i * 0.03 }, opacity: fade }}
              />
            ) : (
              <div className="h-[3px] w-full max-w-6 rounded-full bg-surface-2" />
            )}
          </div>
        );
      })}
    </div>
  );
}

/* ---------- (a)(b) daily bars with a target line ---------- */

type Day = { key: string; totals: Totals; today: boolean };

function DailyBars({
  title,
  unit,
  days,
  values,
  target,
  today,
  other,
}: {
  title: string;
  unit: string;
  days: Day[];
  values: number[];
  target: number;
  today: string;
  other: string;
}) {
  const n = days.length;
  const { active, props } = useScrub(n);
  const max = Math.max(target * 1.15, ...values) || 1;
  const logged = values.filter((v) => v > 0);
  const avg = logged.length ? logged.reduce((s, v) => s + v, 0) / logged.length : 0;
  const summary = `${title}, last ${n} days. Target ${fmt(target)} ${unit}. ${
    logged.length ? `Average ${fmt(avg)} ${unit} across ${logged.length} logged days.` : "Nothing logged yet."
  }`;

  return (
    <ChartCard title={title} aside={logged.length ? `avg ${fmt(avg)} ${unit}` : "14 days"} summary={summary}>
      <div className="relative" role="group" aria-label={`${title} by day. Use arrow keys to read values.`} {...props}>
        <Tooltip index={active} n={n}>
          {active !== null ? <TipValue value={`${fmt(values[active])} ${unit}`} label={shortDate(days[active].key)} /> : null}
        </Tooltip>
        <div className="relative h-40">
          <div className="absolute inset-x-0 bottom-0 h-px bg-line" />
          <motion.div
            className="pointer-events-none absolute inset-x-0 border-t border-dashed border-ink/20"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1, bottom: `${(target / max) * 100}%` }}
            transition={fade}
          >
            <span className="absolute -top-[18px] right-0 text-[10px] tabular-nums text-ink-faint">{fmt(target)}</span>
          </motion.div>
          <Columns values={values} max={max} active={active} color={(i) => (days[i].today ? today : other)} />
        </div>
        <AxisLabels labels={days.map((d) => weekdayShort(d.key))} strong={n - 1} />
      </div>
      <DataTable
        caption={`${title} by day (${unit})`}
        head={["Date", title]}
        rows={days.map((d, i) => [shortDate(d.key), fmt(values[i])])}
      />
    </ChartCard>
  );
}

/* ---------- (c) sleep & mood, small multiples on a shared day axis ---------- */

function SleepMood({ days }: { days: Day[] }) {
  const n = days.length;
  const { active, props } = useScrub(n);
  const raw = useId();
  const clip = `sleep-${raw.replace(/[^a-zA-Z0-9_-]/g, "")}`;

  const sleep = days.map((d) => d.totals.checkin?.sleep);
  const mood = days.map((d) => d.totals.checkin?.mood);
  const top = Math.max(10, ...sleep.map((s) => s ?? 0));
  const x = (i: number) => ((i + 0.5) / n) * 100;
  const y = (s: number) => 100 - (s / top) * 100;

  // Contiguous runs of logged sleep, so missing nights show as gaps.
  const runs: number[][] = [];
  sleep.forEach((s, i) => {
    if (s === undefined) return;
    const last = runs[runs.length - 1];
    if (last && last[last.length - 1] === i - 1) last.push(i);
    else runs.push([i]);
  });

  const logged = sleep.filter((s): s is number => s !== undefined);
  const moods = mood.filter((m): m is NonNullable<CheckIn["mood"]> => m !== undefined);
  const avgSleep = logged.length ? logged.reduce((a, b) => a + b, 0) / logged.length : 0;
  const summary = `Sleep and mood, last ${n} days. ${
    logged.length ? `Average sleep ${avgSleep.toFixed(1)} hours over ${logged.length} nights.` : "No sleep logged yet."
  } ${moods.length ? `Average mood ${(moods.reduce((a, b) => a + b, 0) / moods.length).toFixed(1)} of 5.` : ""}`;

  return (
    <ChartCard
      title="Sleep & mood"
      aside={logged.length ? `avg ${avgSleep.toFixed(1)} h` : "14 days"}
      summary={summary}
      legend={
        <>
          <span className="inline-flex items-center gap-1.5">
            <span className="h-[2px] w-3 rounded-full bg-moss" />
            Sleep
          </span>
          <LegendDot color={ATE} label="Mood" />
        </>
      }
    >
      <div className="relative" role="group" aria-label="Sleep and mood by day. Use arrow keys to read values." {...props}>
        <Tooltip index={active} n={n}>
          {active !== null ? (
            <div className="space-y-0.5">
              <TipValue value={sleep[active] !== undefined ? `${sleep[active]} h` : "—"} label="sleep" />
              <TipValue value={mood[active] !== undefined ? `${mood[active]} / 5` : "—"} label={shortDate(days[active].key)} />
            </div>
          ) : null}
        </Tooltip>

        {/* sleep */}
        <div className="relative h-32">
          {[4, 8].map((h) => (
            <div key={h} className="absolute inset-x-0 h-px bg-line" style={{ top: `${y(h)}%` }}>
              <span className="absolute -top-[15px] left-0 text-[10px] tabular-nums text-ink-faint">{h}h</span>
            </div>
          ))}
          <div className="absolute inset-x-0 bottom-0 h-px bg-line" />
          {active !== null ? (
            <motion.div
              className="absolute inset-y-0 w-px bg-ink/10"
              initial={false}
              animate={{ left: `${x(active)}%` }}
              transition={calm}
            />
          ) : null}
          <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="absolute inset-0 h-full w-full overflow-visible" aria-hidden="true">
            <defs>
              <clipPath id={clip}>
                <motion.rect x="0" y="-10" height="120" initial={{ width: 0 }} animate={{ width: 100 }} transition={{ duration: 1.2, ease: [0.22, 1, 0.36, 1] }} />
              </clipPath>
            </defs>
            <g clipPath={`url(#${clip})`}>
              {runs
                .filter((r) => r.length > 1)
                .map((r) => {
                  const line = r.map((i, j) => `${j ? "L" : "M"}${x(i)} ${y(sleep[i]!)}`).join(" ");
                  const area = `${line} L${x(r[r.length - 1])} 100 L${x(r[0])} 100 Z`;
                  return (
                    <g key={r[0]}>
                      <path d={area} fill="var(--moss)" fillOpacity={0.1} />
                      <path
                        d={line}
                        fill="none"
                        stroke="var(--moss)"
                        strokeWidth={2}
                        strokeLinejoin="round"
                        strokeLinecap="round"
                        vectorEffect="non-scaling-stroke"
                      />
                    </g>
                  );
                })}
            </g>
          </svg>
          {sleep.map((s, i) => {
            if (s === undefined) return null;
            const isolated = sleep[i - 1] === undefined && sleep[i + 1] === undefined;
            const show = isolated || active === i;
            return (
              <motion.span
                key={i}
                className="absolute h-2 w-2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-moss ring-2 ring-surface"
                style={{ left: `${x(i)}%`, top: `${y(s)}%` }}
                initial={false}
                animate={{ opacity: show ? 1 : 0, scale: show ? 1 : 0.5 }}
                transition={calm}
              />
            );
          })}
        </div>

        {/* mood */}
        <div className="relative mt-4 h-12 rounded-xl bg-bg">
          {mood.map((m, i) =>
            m === undefined ? null : (
              <motion.span
                key={i}
                className="absolute h-2 w-2 rounded-full ring-2 ring-bg"
                style={{ left: `${x(i)}%`, top: `${12 + (1 - (m - 1) / 4) * 76}%`, background: ATE, translateX: "-50%", translateY: "-50%" }}
                initial={{ opacity: 0, scale: 0.4 }}
                animate={{ opacity: active === null || active === i ? 1 : 0.45, scale: active === i ? 1.35 : 1 }}
                transition={{ ...calm, delay: active === null ? 0.2 + i * 0.03 : 0 }}
              />
            ),
          )}
          {moods.length === 0 ? (
            <span className="absolute inset-0 grid place-items-center text-[11px] text-ink-faint">Mood appears after check-ins</span>
          ) : null}
        </div>

        <AxisLabels labels={days.map((d) => weekdayShort(d.key))} strong={n - 1} />
      </div>
      <DataTable
        caption="Sleep (hours) and mood (1 to 5) by day"
        head={["Date", "Sleep", "Mood"]}
        rows={days.map((d, i) => [shortDate(d.key), sleep[i] !== undefined ? `${sleep[i]}` : "—", mood[i] ? `${mood[i]}` : "—"])}
      />
    </ChartCard>
  );
}

/* ---------- (d) workouts and rest per week ---------- */

type Week = { key: string; current: boolean; workouts: number; rest: number };

function WeeklyBars({ weeks }: { weeks: Week[] }) {
  const n = weeks.length;
  const { active, props } = useScrub(n);
  const wMax = Math.max(4, ...weeks.map((w) => w.workouts));
  const rMax = Math.max(30, ...weeks.map((w) => w.rest));
  const total = weeks.reduce((s, w) => s + w.workouts, 0);
  const restTotal = weeks.reduce((s, w) => s + w.rest, 0);
  const summary = `Workouts and rest minutes per week, last ${n} weeks. ${total} workouts and ${restTotal} rest minutes in total.`;

  return (
    <ChartCard
      title="Weekly"
      aside="8 weeks"
      summary={summary}
      legend={
        <>
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-[2px] bg-moss" />
            Workouts
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-[2px]" style={{ background: RESTED }} />
            Rest min
          </span>
        </>
      }
    >
      <div className="relative" role="group" aria-label="Workouts and rest by week. Use arrow keys to read values." {...props}>
        <Tooltip index={active} n={n}>
          {active !== null ? (
            <div className="space-y-0.5">
              <TipValue value={weeks[active].workouts} label={weeks[active].workouts === 1 ? "workout" : "workouts"} />
              <TipValue value={`${weeks[active].rest} min`} label={`week of ${shortDate(weeks[active].key)}`} />
            </div>
          ) : null}
        </Tooltip>
        <div className="relative h-28">
          <div className="absolute inset-x-0 bottom-0 h-px bg-line" />
          <Columns values={weeks.map((w) => w.workouts)} max={wMax} active={active} color={() => MOVED} />
        </div>
        <div className="relative mt-3 h-12">
          <div className="absolute inset-x-0 top-0 h-px bg-line" />
          {/* Rest hangs from its own baseline: a separate small multiple, never a second axis. */}
          <div className="absolute inset-0 flex items-start">
            {weeks.map((w, i) => (
              <div key={w.key} className="flex h-full min-w-0 flex-1 items-start justify-center px-[2px] sm:px-[3px]">
                {w.rest > 0 ? (
                  <motion.div
                    className="w-full max-w-6 rounded-b-[4px]"
                    style={{ background: RESTED }}
                    initial={{ height: 0 }}
                    animate={{ height: `${Math.max(4, (w.rest / rMax) * 100)}%`, opacity: active === null || active === i ? 1 : 0.45 }}
                    transition={{ height: { ...grow, delay: 0.15 + i * 0.03 }, opacity: fade }}
                  />
                ) : (
                  <div className="h-[3px] w-full max-w-6 rounded-full bg-surface-2" />
                )}
              </div>
            ))}
          </div>
        </div>
        <AxisLabels labels={weeks.map((w) => numericDate(w.key))} strong={n - 1} />
      </div>
      <DataTable
        caption="Workouts and rest minutes by week"
        head={["Week of", "Workouts", "Rest (min)"]}
        rows={weeks.map((w) => [shortDate(w.key), `${w.workouts}`, `${w.rest}`])}
      />
    </ChartCard>
  );
}

/* ---------- table view (screen readers) ---------- */

function DataTable({ caption, head, rows }: { caption: string; head: string[]; rows: string[][] }) {
  return (
    <table className="sr-only">
      <caption>{caption}</caption>
      <thead>
        <tr>
          {head.map((h) => (
            <th key={h} scope="col">
              {h}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((r) => (
          <tr key={r[0]}>
            {r.map((v, i) => (i === 0 ? <th key={i} scope="row">{v}</th> : <td key={i}>{v}</td>))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}
