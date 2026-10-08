"use client";

import { motion } from "framer-motion";
import { ArrowUpRight, Camera, Check, Flame, Moon, Play } from "lucide-react";

import { useApp } from "@/components/app";
import { Bar, Button, calm, Card, ImageSlot, Ring } from "@/components/ui";
import { IMAGES } from "@/lib/images";
import { streak, todayOf, totalsFor } from "@/lib/store";
import { cn, countdown, greeting, lastNDays, longDate, nextAt, weekdayShort } from "@/lib/utils";

const stagger = {
  hidden: {},
  show: { transition: { staggerChildren: 0.06 } },
};
const rise = {
  hidden: { opacity: 0, y: 14 },
  show: { opacity: 1, y: 0, transition: calm },
};

export function TodayView() {
  const { data, open, go } = useApp();
  const profile = data.profile!;
  const t = todayOf(data);
  const days = streak(data);
  const session = t.session!;
  const done = t.day.status === "done";
  const progress = session.exercises.length ? t.day.completed.length / session.exercises.length : 0;

  return (
    <motion.div variants={stagger} initial="hidden" animate="show" className="space-y-6 lg:space-y-8">
      <motion.header variants={rise} className="flex flex-wrap items-end justify-between gap-4">
        <div>
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

      {/* Hero: today's practice */}
      <motion.div variants={rise}>
        <ImageSlot src={IMAGES.hero} tone="sage" label="Image" className="h-[300px] sm:h-[340px]">
          <div className="flex h-full flex-col justify-end p-6 sm:p-9">
            <div className="max-w-md rounded-[24px] bg-[rgba(251,250,246,0.78)] p-5 backdrop-blur-md sm:p-6">
              <div className="eyebrow">{session.rest ? "Gentle day" : "Today's practice"}</div>
              <div className="mt-2 flex items-end justify-between gap-4">
                <div>
                  <div className="font-display text-3xl">{session.title}</div>
                  <div className="mt-1 text-sm text-ink-soft">
                    {session.minutes} min · {session.exercises.length} moves
                  </div>
                </div>
                <Button onClick={() => go("move")} icon={done ? Check : Play} variant={done ? "soft" : "primary"}>
                  {done ? "Done" : "Start"}
                </Button>
              </div>
              {!done && progress > 0 ? (
                <div className="mt-4">
                  <Bar value={progress} />
                </div>
              ) : null}
            </div>
          </div>
        </ImageSlot>
      </motion.div>

      <div className="grid gap-4 [&>*]:min-w-0 md:grid-cols-2 lg:gap-6">
        {/* Nourish */}
        <Card variants={rise} className="flex flex-col">
          <div className="flex items-start justify-between">
            <div className="eyebrow">Nourish</div>
            <button type="button" onClick={() => go("nourish")} aria-label="Open Nourish" className="-m-2 rounded-full p-2 text-ink-faint hover:text-ink">
              <ArrowUpRight className="h-4 w-4" />
            </button>
          </div>
          <div className="mt-4 flex items-center gap-6">
            <Ring value={t.calories / profile.calorieTarget} size={112} stroke={7}>
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
            <div className="relative grid h-[112px] w-[112px] shrink-0 place-items-center">
              <span className="absolute inset-0 rounded-full bg-[#e9e3ea]" />
              <span
                className={cn("absolute inset-5 rounded-full", t.recovered ? "bg-moss" : "bg-[#cbbfd0]")}
                style={{ animation: "breathe 8s ease-in-out infinite" }}
              />
              {t.recovered ? <Check className="relative h-6 w-6 text-white" strokeWidth={2} /> : <Moon className="relative h-5 w-5 text-white" strokeWidth={1.8} />}
            </div>
            <div>
              <div className="font-display text-2xl">{t.recovered ? "Rested" : "Evening reset"}</div>
              <div className="mt-1 text-sm text-ink-soft">
                {t.recovered ? `${t.recoveryMinutes} min today` : countdown(nextAt(profile.recoveryTime))}
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
              <div key={key} className={cn("flex flex-col items-center gap-3 rounded-2xl py-3", isToday && "bg-surface-2")}>
                <span className={cn("text-xs", isToday ? "font-semibold text-ink" : "text-ink-faint")}>{weekdayShort(key)}</span>
                <div className="flex flex-col gap-1.5">
                  <Dot on={d.calories > 0} color="bg-clay" />
                  <Dot on={d.workout} color="bg-moss" />
                  <Dot on={d.recovered} color="bg-[#b5a5bb]" />
                </div>
              </div>
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
