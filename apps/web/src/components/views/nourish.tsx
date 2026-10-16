"use client";

import { AnimatePresence, motion } from "framer-motion";
import { Camera, Download, Plus, Utensils, X } from "lucide-react";
import { useMemo, useState } from "react";

import { useApp } from "@/components/app";
import { Bar, Button, calm, Card, Chip, ImageSlot } from "@/components/ui";
import { PlateScene } from "@/components/three";
import { estimateFromItems, foodById, parseFoodText, QUICK_FOODS } from "@/lib/foods";
import { IMAGES } from "@/lib/images";
import { Illustration } from "@/components/visuals";
import { actions, todayOf, totalsFor } from "@/lib/store";
import { cn, formatClock, lastNDays, weekdayShort } from "@/lib/utils";

export function NourishView() {
  const { data, open, toast, covered } = useApp();
  const profile = data.profile!;
  const t = todayOf(data);
  const [text, setText] = useState("");
  const preview = useMemo(() => {
    const items = parseFoodText(text);
    return items.length ? estimateFromItems(items) : null;
  }, [text]);

  const week = lastNDays(7).map((key) => ({ key, ...totalsFor(data, key) }));
  const max = Math.max(profile.calorieTarget, ...week.map((d) => d.calories));

  function addText() {
    if (!preview) return;
    actions.addMeal({ ...preview, source: "text" });
    toast(`Logged ${preview.name}`);
    setText("");
  }

  function quickAdd(id: string) {
    const food = foodById(id);
    if (!food) return;
    actions.addMeal({ ...estimateFromItems([{ food, qty: 1 }]), source: "quick" });
    toast(`Added ${food.name.toLowerCase()}`);
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

      <div className="grid gap-4 [&>*]:min-w-0 lg:grid-cols-[1.25fr_1fr] lg:gap-6">
        <section className="relative overflow-hidden rounded-[32px] border border-line bg-[radial-gradient(110%_100%_at_30%_10%,#fbf9f5_0%,#f3ece3_60%,#ebe1d4_100%)]">
          <div className="grid items-center [&>*]:min-w-0 sm:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)]">
            <PlateScene fill={t.calories / profile.calorieTarget} active={!covered} className="h-[250px] sm:h-[300px]" />
            <div className="space-y-5 px-6 pb-7 sm:py-8 sm:pl-0 sm:pr-8">
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

        <ImageSlot src={IMAGES.nourish} tone="clay" alt="A colourful bowl of food" className="hidden min-h-[240px] lg:block" />
      </div>

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
        <div className="no-scrollbar -mx-5 mt-5 flex gap-2 overflow-x-auto px-5 sm:-mx-6 sm:px-6">
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
              <ul className="-mx-2">
                <AnimatePresence initial={false}>
                  {t.meals.map((m) => (
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
                        {m.photo ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={m.photo} alt="" className="h-12 w-12 shrink-0 rounded-2xl object-cover" />
                        ) : (
                          <Illustration kind="meal" className="h-12 w-12 shrink-0 rounded-2xl bg-clay-soft/50 p-1" />
                        )}
                        <div className="min-w-0 flex-1">
                          <div className="truncate font-medium">{m.name}</div>
                          <div className="truncate text-xs text-ink-faint">
                            {formatClock(m.at)} · {m.items.join(", ")}
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-sm tabular-nums">{m.calories}</div>
                          <div className="text-xs tabular-nums text-ink-faint">{m.protein}g</div>
                        </div>
                        <button
                          type="button"
                          aria-label={`Remove ${m.name}`}
                          onClick={() => actions.removeMeal(m.id)}
                          className="grid h-8 w-8 place-items-center rounded-full text-ink-faint opacity-100 hover:bg-surface hover:text-ink sm:opacity-0 sm:group-hover:opacity-100"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </div>
                    </motion.li>
                  ))}
                </AnimatePresence>
              </ul>
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
