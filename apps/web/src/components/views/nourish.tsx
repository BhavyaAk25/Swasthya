"use client";

import { AnimatePresence, motion } from "framer-motion";
import { Camera, Download, Plus, RotateCcw, Utensils, X } from "lucide-react";
import { useMemo, useState } from "react";

import { useApp } from "@/components/app";
import { Bar, Button, calm, Card, Chip } from "@/components/ui";
import { PlateScene } from "@/components/three";
import { estimateFromItems, foodById, parseFoodText, QUICK_FOODS } from "@/lib/foods";
import { Illustration } from "@/components/visuals";
import { actions, recentMeals, todayOf, totalsFor } from "@/lib/store";
import type { Meal } from "@/lib/types";
import { cn, formatClock, haptic, lastNDays, weekdayShort } from "@/lib/utils";

const PORTIONS = [0.5, 1, 1.5, 2];
const portionLabel = (p: number) => `${p === 0.5 ? "½" : p === 1.5 ? "1½" : p}×`;

const MEAL_TIMES = [
  { id: "breakfast", label: "Breakfast" },
  { id: "lunch", label: "Lunch" },
  { id: "snack", label: "Snacks" },
  { id: "dinner", label: "Dinner" },
] as const;

function mealTime(m: Meal) {
  const h = new Date(m.at).getHours();
  return h < 5 ? "dinner" : h < 11 ? "breakfast" : h < 15 ? "lunch" : h < 18 ? "snack" : "dinner";
}

export function NourishView() {
  const { data, open, toast, covered } = useApp();
  const profile = data.profile!;
  const t = todayOf(data);
  const [text, setText] = useState("");
  const [editing, setEditing] = useState<string | null>(null);
  const recent = recentMeals(data, 6);
  // Today's meals in eating order, grouped by time of day.
  const groups = MEAL_TIMES.map((g) => ({ ...g, meals: [...t.meals].reverse().filter((m) => mealTime(m) === g.id) })).filter((g) => g.meals.length);
  const preview = useMemo(() => {
    const items = parseFoodText(text);
    return items.length ? estimateFromItems(items) : null;
  }, [text]);

  const week = lastNDays(7).map((key) => ({ key, ...totalsFor(data, key) }));
  const max = Math.max(profile.calorieTarget, ...week.map((d) => d.calories));

  function addText() {
    if (!preview) return;
    toast(`Logged ${preview.name}`, actions.withUndo(() => actions.addMeal({ ...preview, source: "text" })));
    setText("");
  }

  function relog(m: Meal) {
    const { name, items, calories, protein, confidence } = m;
    toast(`Logged ${name}`, actions.withUndo(() => actions.addMeal({ name, items, calories, protein, confidence, source: "quick" })));
  }

  function quickAdd(id: string) {
    const food = foodById(id);
    if (!food) return;
    haptic();
    toast(`Added ${food.name.toLowerCase()}`, actions.withUndo(() => actions.addMeal({ ...estimateFromItems([{ food, qty: 1 }]), source: "quick" })));
  }

  return (
    <div className="space-y-6 lg:space-y-8">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="eyebrow">Nourish</div>
          <h1 className="mt-2 font-display text-4xl font-light sm:text-5xl">Eat with ease</h1>
        </div>
        <Button icon={Camera} onClick={() => open("camera")}>
          Snap a meal
        </Button>
      </header>

      {/* The bowl is the hero: it fills as the day's food adds up. */}
      <section className="relative overflow-hidden rounded-[32px] border border-line bg-[radial-gradient(110%_100%_at_30%_10%,#fbf9f5_0%,#f3ece3_60%,#ebe1d4_100%)]">
          <div className="grid items-center [&>*]:min-w-0 sm:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
            <PlateScene fill={t.calories / profile.calorieTarget} active={!covered} className="h-[280px] sm:h-[360px] lg:h-[400px]" />
            <div className="space-y-5 px-6 pb-7 sm:py-8 sm:pl-0 sm:pr-10 lg:pr-14">
              <div>
                <div className="flex items-baseline gap-1.5">
                  <span className="font-display text-5xl tabular-nums">{t.calories}</span>
                  <span className="text-sm text-ink-faint">kcal today</span>
                </div>
                <p className="mt-1 text-xs text-ink-faint">Your bowl fills as you eat. Estimates, not exact values.</p>
              </div>
              <Metric label="Calories" value={t.calories} target={profile.calorieTarget} unit="kcal" color="var(--moss)" />
              <Metric label="Protein" value={t.protein} target={profile.proteinTarget} unit="g" color="var(--clay)" />
            </div>
          </div>
      </section>

      {/* Quick log */}
      <Card>
        <div className="eyebrow">Quick log</div>
        <div className="mt-4 flex items-center gap-2 rounded-full border border-line bg-bg p-1.5 pl-5 focus-within:border-sage">
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && addText()}
            placeholder="2 eggs, toast and coffee"
            maxLength={200}
            className="min-w-0 flex-1 bg-transparent text-[15px] outline-none placeholder:text-ink-faint"
          />
          <Button size="sm" onClick={addText} disabled={!preview} icon={Plus}>
            Add
          </Button>
        </div>
        <AnimatePresence initial={false}>
          {text.trim() ? (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              transition={calm}
              className="overflow-hidden"
            >
              <div className="px-5 pt-3 text-sm text-ink-soft">
                {preview ? (
                  <>
                    {preview.items.join(" · ")} — <span className="text-ink">{preview.calories} kcal</span>, {preview.protein}g protein
                  </>
                ) : (
                  "Try simple foods like eggs, rice, dal, salad."
                )}
              </div>
            </motion.div>
          ) : null}
        </AnimatePresence>
        {recent.length ? (
          <div className="no-scrollbar -mx-5 mt-5 flex items-center gap-2 overflow-x-auto px-5 sm:-mx-6 sm:px-6">
            <span className="flex shrink-0 items-center gap-1.5 pr-1 text-xs font-medium text-ink-faint">
              <RotateCcw className="h-3.5 w-3.5" /> Again
            </span>
            {recent.map((m) => (
              <Chip key={m.id} onClick={() => relog(m)} className="shrink-0">
                {m.name} <span className="text-ink-faint">· {m.calories}</span>
              </Chip>
            ))}
          </div>
        ) : null}
        <div className="no-scrollbar -mx-5 mt-3 flex gap-2 overflow-x-auto px-5 sm:-mx-6 sm:px-6">
          {QUICK_FOODS.map((id) => {
            const f = foodById(id)!;
            return (
              <Chip key={id} onClick={() => quickAdd(id)}>
                + {f.name}
              </Chip>
            );
          })}
        </div>
      </Card>

      <div className="grid gap-4 [&>*]:min-w-0 lg:grid-cols-[1.4fr_1fr] lg:gap-6">
        {/* Today's meals */}
        <Card>
          <div className="eyebrow">Today</div>
          <div className="mt-4">
            {t.meals.length === 0 ? (
              <div className="flex flex-col items-center py-10 text-center">
                <div className="grid h-12 w-12 place-items-center rounded-full bg-surface-2 text-ink-faint">
                  <Utensils className="h-5 w-5" strokeWidth={1.6} />
                </div>
                <p className="mt-3 text-sm text-ink-soft">Your meals will appear here.</p>
              </div>
            ) : (
              <div className="-mx-2 space-y-4">
                {groups.map((g) => (
                  <div key={g.id}>
                    <div className="flex items-baseline justify-between px-2 pb-1">
                      <span className="eyebrow">{g.label}</span>
                      <span className="text-xs tabular-nums text-ink-faint">{g.meals.reduce((sum, m) => sum + m.calories, 0)} kcal</span>
                    </div>
                    <ul>
                      <AnimatePresence initial={false}>
                        {g.meals.map((m) => (
                          <motion.li
                            key={m.id}
                            layout
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: "auto" }}
                            exit={{ opacity: 0, height: 0 }}
                            transition={calm}
                            className="overflow-hidden"
                          >
                            <div className="group flex items-center gap-4 rounded-2xl px-2 py-2.5 hover:bg-surface-2/60">
                              <button
                                type="button"
                                onClick={() => setEditing(editing === m.id ? null : m.id)}
                                aria-expanded={editing === m.id}
                                aria-label={`${m.name}, change portion`}
                                className="flex min-w-0 flex-1 items-center gap-4 text-left"
                              >
                                {m.photo ? (
                                  // eslint-disable-next-line @next/next/no-img-element
                                  <img src={m.photo} alt="" className="h-12 w-12 shrink-0 rounded-2xl object-cover" />
                                ) : (
                                  <Illustration kind="meal" className="h-12 w-12 shrink-0 rounded-2xl bg-clay-soft/50 p-1" />
                                )}
                                <span className="min-w-0 flex-1">
                                  <span className="block truncate font-medium">
                                    {m.name}
                                    {m.portion && m.portion !== 1 ? <span className="text-ink-faint"> · {portionLabel(m.portion)}</span> : null}
                                  </span>
                                  <span className="block truncate text-xs text-ink-faint">
                                    {formatClock(m.at)} · {m.items.join(", ")}
                                  </span>
                                </span>
                                <span className="text-right">
                                  <span className="block text-sm tabular-nums">{m.calories}</span>
                                  <span className="block text-xs tabular-nums text-ink-faint">{m.protein}g</span>
                                </span>
                              </button>
                              <button
                                type="button"
                                aria-label={`Remove ${m.name}`}
                                onClick={() => toast(`Removed ${m.name}`, actions.withUndo(() => actions.removeMeal(m.id)))}
                                className="grid h-8 w-8 place-items-center rounded-full text-ink-faint opacity-100 hover:bg-surface hover:text-ink sm:opacity-0 sm:group-hover:opacity-100"
                              >
                                <X className="h-4 w-4" />
                              </button>
                            </div>
                            <AnimatePresence initial={false}>
                              {editing === m.id ? (
                                <motion.div
                                  initial={{ opacity: 0, height: 0 }}
                                  animate={{ opacity: 1, height: "auto" }}
                                  exit={{ opacity: 0, height: 0 }}
                                  transition={calm}
                                  className="overflow-hidden"
                                >
                                  <div className="flex items-center gap-2 px-2 pb-3 pl-[72px]">
                                    <span className="text-xs text-ink-faint">Portion</span>
                                    {PORTIONS.map((p) => (
                                      <Chip key={p} active={(m.portion ?? 1) === p} onClick={() => actions.setPortion(m.id, p)}>
                                        {portionLabel(p)}
                                      </Chip>
                                    ))}
                                  </div>
                                </motion.div>
                              ) : null}
                            </AnimatePresence>
                          </motion.li>
                        ))}
                      </AnimatePresence>
                    </ul>
                  </div>
                ))}
              </div>
            )}
          </div>
        </Card>

        {/* Week chart */}
        <Card className="flex flex-col">
          <div className="flex items-center justify-between">
            <div className="eyebrow">7 days</div>
            <button
              type="button"
              onClick={actions.exportCsv}
              disabled={data.meals.length === 0}
              className="-m-2 flex items-center gap-1.5 rounded-full p-2 text-xs font-medium text-ink-faint hover:text-ink disabled:opacity-40"
            >
              <Download className="h-3.5 w-3.5" /> CSV
            </button>
          </div>
          <div className="relative mt-auto flex h-40 shrink-0 items-end gap-2 pt-6">
            <div
              className="pointer-events-none absolute inset-x-0 border-t border-dashed border-ink/10"
              style={{ bottom: `${(profile.calorieTarget / max) * 100}%` }}
            />
            {week.map((d, i) => (
              <div key={d.key} className="flex h-full flex-1 flex-col items-center justify-end gap-2">
                <motion.div
                  title={`${d.calories} kcal`}
                  initial={{ height: 0 }}
                  animate={{ height: `${Math.max(d.calories ? 4 : 2, (d.calories / max) * 100)}%` }}
                  transition={{ duration: 0.9, delay: i * 0.04, ease: [0.22, 1, 0.36, 1] }}
                  className={cn("w-full max-w-7 rounded-full", i === 6 ? "bg-moss" : d.calories ? "bg-sage/70" : "bg-surface-2")}
                />
              </div>
            ))}
          </div>
          <div className="mt-2 flex gap-2">
            {week.map((d, i) => (
              <span key={d.key} className={cn("flex-1 text-center text-xs", i === 6 ? "font-semibold text-ink" : "text-ink-faint")}>
                {weekdayShort(d.key)}
              </span>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}

function Metric({ label, value, target, unit, color }: { label: string; value: number; target: number; unit: string; color: string }) {
  return (
    <div>
      <div className="flex justify-between text-sm">
        <span className="text-ink-soft">{label}</span>
        <span className="tabular-nums">
          {value}
          <span className="text-ink-faint">
            {" "}
            / {target} {unit}
          </span>
        </span>
      </div>
      <div className="mt-2">
        <Bar value={value / target} color={color} />
      </div>
    </div>
  );
}
