"use client";

import { AnimatePresence, motion } from "framer-motion";
import { ArrowRight, ArrowUpRight, Camera, Check, Flame, Hand, Moon, Play } from "lucide-react";

import { useApp } from "@/components/app";
import { CheckInCard } from "@/components/checkin";
import { CoachNote } from "@/components/coach-note";
import { Milestone } from "@/components/milestone";
import { HeroScene, RestoreScene } from "@/components/three";
import { Bar, Button, calm, Card, Ring } from "@/components/ui";
import { BreathingTide } from "@/components/visuals";
import { streak, todayOf, totalsFor } from "@/lib/store";
import { cn, dayPart, greeting, lastNDays, longDate, weekdayShort, whenLabel } from "@/lib/utils";

const stagger = {
  hidden: {},
  show: { transition: { staggerChildren: 0.06 } },
};
const rise = {
  hidden: { opacity: 0, y: 14 },
  show: { opacity: 1, y: 0, transition: calm },
};

export function TodayView() {
  const { data, open, go, covered } = useApp();
  const profile = data.profile!;
  const t = todayOf(data);
  const days = streak(data);
  const session = t.session!;
  const done = t.day.status === "done";
  const completed = t.day.completed.filter((id) => session.exercises.some((e) => e.id === id)).length;
  const progress = session.exercises.length ? completed / session.exercises.length : 0;
  const note = "note" in session ? (session.note as string | undefined) : undefined;
  // From an hour before the reset time (and late at night), the day's hero becomes the wind-down.
  const part = dayPart(profile.recoveryTime);
  const windDown = part !== "day" && !t.recovered;

  return (
    <motion.div variants={stagger} initial="hidden" animate="show" className="space-y-6 lg:space-y-8">
      <motion.header variants={rise} className="flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          <div className="eyebrow">{longDate()}</div>
          <h1 className="mt-2 font-display text-4xl font-light sm:text-5xl">
            {greeting()}, {profile.name}
          </h1>
        </div>
        {days > 0 ? (
          <div className="flex items-center gap-2 rounded-full bg-clay-soft px-4 py-2 text-sm font-medium text-[#8a6440]">
            <Flame className="h-4 w-4" strokeWidth={1.8} />
            {days} day{days === 1 ? "" : "s"}
          </div>
        ) : null}
      </motion.header>

      {/* Hero: the two friends + today's practice */}
      <motion.section
        variants={rise}
        className="relative overflow-hidden rounded-[32px] border border-line bg-bg"
      >
        <div className="grid [&>*]:min-w-0 lg:grid-cols-[minmax(0,0.92fr)_minmax(0,1.08fr)]">
          {windDown ? (
          <div className="order-2 flex flex-col justify-center px-6 pb-7 pt-1 sm:px-9 sm:pb-9 lg:order-1 lg:py-12 lg:pl-12 lg:pr-4">
            <div className="eyebrow">{part === "night" ? "Late night" : "This evening"}</div>
            <h2 className="mt-2 font-display text-4xl leading-[1.05] sm:text-5xl">Wind down</h2>
            <p className="mt-2 text-ink-soft">Yoga nidra · 10 min · lights low</p>
            <div className="mt-7 flex flex-wrap items-center gap-3">
              <Button size="lg" icon={Moon} onClick={() => open({ recovery: { minutes: 10 } })}>
                Begin reset
              </Button>
              {!done && part === "wind" ? (
                <Button variant="ghost" onClick={() => go("move")}>
                  Today&apos;s practice <ArrowRight className="h-4 w-4" />
                </Button>
              ) : null}
            </div>
          </div>
          ) : (
          <div className="order-2 flex flex-col justify-center px-6 pb-7 pt-1 sm:px-9 sm:pb-9 lg:order-1 lg:py-12 lg:pl-12 lg:pr-4">
            <div className="eyebrow">{session.rest ? "Gentle day" : "Today's practice"}</div>
            <h2 className="mt-2 font-display text-4xl leading-[1.05] sm:text-5xl">{session.title}</h2>
            <p className="mt-2 text-ink-soft">
              {session.focus} · {session.minutes} min · {session.exercises.length} moves
            </p>
            <AnimatePresence initial={false}>
              {note ? (
                <motion.p
                  key={note}
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={calm}
                  className="mt-3 max-w-sm overflow-hidden text-sm text-moss"
                >
                  {note}
                </motion.p>
              ) : null}
            </AnimatePresence>
            {!done && progress > 0 ? (
              <div className="mt-5 max-w-sm">
                <Bar value={progress} />
              </div>
            ) : null}
            <div className="mt-7 flex flex-wrap items-center gap-3">
              {done ? (
                <Button variant="soft" icon={Check} onClick={() => go("move")}>
                  Done for today
                </Button>
              ) : (
                <Button size="lg" icon={Play} onClick={() => open("workout")}>
                  {progress > 0 ? "Continue" : "Start session"}
                </Button>
              )}
              <Button variant="ghost" onClick={() => go("move")}>
                See moves <ArrowRight className="h-4 w-4" />
              </Button>
            </div>
            <p className="mt-6 hidden items-center gap-2 text-xs text-ink-faint lg:flex">
              <Hand className="h-3.5 w-3.5" strokeWidth={1.6} /> Tap a friend to train with them
            </p>
          </div>
          )}
          <div className="order-1 h-[290px] sm:h-[400px] lg:order-2 lg:h-[500px]">
            {windDown ? <RestoreScene active={!covered} className="h-full w-full" /> : <HeroScene className="h-full w-full" active={!covered} />}
          </div>
        </div>
      </motion.section>

      <Milestone streak={days} />

      {/* One calm suggestion: check-in rule first, else the AI coach note */}
      <CoachNote />

      <div className="grid gap-4 [&>*]:min-w-0 md:grid-cols-2 lg:gap-6 xl:grid-cols-3">
        {/* Nourish */}
        <Card variants={rise} className="flex flex-col">
          <div className="flex items-start justify-between">
            <div className="eyebrow">Nourish</div>
            <button type="button" onClick={() => go("nourish")} aria-label="Open Nourish" className="-m-2 rounded-full p-2 text-ink-faint hover:text-ink">
              <ArrowUpRight className="h-4 w-4" />
            </button>
          </div>
          <div className="mt-4 flex flex-1 items-center gap-6">
            <Ring value={t.calories / profile.calorieTarget} size={108} stroke={7}>
              <div>
                <div className="font-display text-2xl tabular-nums">{t.calories}</div>
                <div className="text-[11px] text-ink-faint">of {profile.calorieTarget}</div>
              </div>
            </Ring>
            <div className="min-w-0 flex-1 space-y-3">
              <div>
                <div className="flex justify-between text-sm">
                  <span className="text-ink-soft">Protein</span>
                  <span className="tabular-nums">
                    {t.protein}
                    <span className="text-ink-faint"> / {profile.proteinTarget}g</span>
                  </span>
                </div>
                <div className="mt-2">
                  <Bar value={t.protein / profile.proteinTarget} color="var(--clay)" />
                </div>
              </div>
              <div className="text-sm text-ink-soft">
                {t.meals.length ? `${t.meals.length} meal${t.meals.length === 1 ? "" : "s"} logged` : "Nothing logged yet"}
              </div>
            </div>
          </div>
          <Button variant="soft" icon={Camera} className="mt-6 w-full" onClick={() => open("camera")}>
            Log a meal
          </Button>
        </Card>

        {/* Restore */}
        <Card variants={rise} className="flex flex-col">
          <div className="flex items-start justify-between">
            <div className="eyebrow">Restore</div>
            <button type="button" onClick={() => go("restore")} aria-label="Open Restore" className="-m-2 rounded-full p-2 text-ink-faint hover:text-ink">
              <ArrowUpRight className="h-4 w-4" />
            </button>
          </div>
          <div className="mt-4 flex flex-1 items-center gap-6">
            <div className="relative grid h-[108px] w-[108px] shrink-0 place-items-center">
              <BreathingTide level={t.recovered ? 0.5 : undefined} />
              {t.recovered ? (
                <span className="absolute bottom-1 right-1 grid h-7 w-7 place-items-center rounded-full bg-moss">
                  <Check className="h-4 w-4 text-white" strokeWidth={2} />
                </span>
              ) : null}
            </div>
            <div className="min-w-0">
              <div className="font-display text-2xl">{t.recovered ? "Rested" : "Evening reset"}</div>
              <div className="mt-1 text-sm text-ink-soft">
                {t.recovered ? `${t.recoveryMinutes} min today` : whenLabel(profile.recoveryTime)}
              </div>
            </div>
          </div>
          <Button
            variant={t.recovered ? "outline" : "soft"}
            icon={Play}
            className="mt-6 w-full"
            onClick={() => open({ recovery: { minutes: 10 } })}
          >
            {t.recovered ? "Again" : "Begin now"}
          </Button>
        </Card>

        <motion.div variants={rise} className="md:col-span-2 xl:col-span-1">
          <CheckInCard className="h-full" />
        </motion.div>
      </div>

      {/* Week */}
      <Card variants={rise}>
        <div className="flex items-center justify-between">
          <div className="eyebrow">This week</div>
          <div className="flex gap-4 text-[11px] text-ink-faint">
            <Legend color="bg-clay" label="Ate" />
            <Legend color="bg-moss" label="Moved" />
            <Legend color="bg-[#b5a5bb]" label="Rested" />
          </div>
        </div>
        <div className="mt-5 grid grid-cols-7 gap-2">
          {lastNDays(7).map((key, i) => {
            const d = totalsFor(data, key);
            const isToday = i === 6;
            return (
              <button
                key={key}
                type="button"
                onClick={() => go("progress")}
                className={cn("flex flex-col items-center gap-3 rounded-2xl py-3 hover:bg-surface-2/70", isToday && "bg-surface-2")}
              >
                <span className={cn("text-xs", isToday ? "font-semibold text-ink" : "text-ink-faint")}>{weekdayShort(key)}</span>
                <span className="flex flex-col gap-1.5">
                  <Dot on={d.calories > 0} color="bg-clay" />
                  <Dot on={d.workout} color="bg-moss" />
                  <Dot on={d.recovered} color="bg-[#b5a5bb]" />
                </span>
              </button>
            );
          })}
        </div>
      </Card>
    </motion.div>
  );
}

function Dot({ on, color }: { on: boolean; color: string }) {
  return (
    <motion.span
      initial={false}
      animate={{ scale: on ? 1 : 0.6, opacity: on ? 1 : 0.25 }}
      transition={calm}
      className={cn("block h-2 w-2 rounded-full", on ? color : "bg-ink-faint")}
    />
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <span className="hidden items-center gap-1.5 sm:flex">
      <span className={cn("h-1.5 w-1.5 rounded-full", color)} />
      {label}
    </span>
  );
}
