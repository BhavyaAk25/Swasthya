"use client";

import { Mic, Play } from "lucide-react";
import { useState } from "react";

import { useApp } from "@/components/app";
import { Button, Card, Chip } from "@/components/ui";
import { RestoreScene } from "@/components/three";
import { LENGTHS } from "@/lib/recovery";
import { actions, todayOf } from "@/lib/store";
import { countdown, formatClock, lastNDays, nextAt, weekdayShort, whenLabel } from "@/lib/utils";
import { stageStyle } from "@/lib/stages";

export function RestoreView() {
  const { data, open, ai, toast, covered } = useApp();
  const profile = data.profile!;
  const t = todayOf(data);
  const [minutes, setMinutes] = useState<number>(10);
  const week = lastNDays(7);
  const weekMinutes = data.recovery.filter((r) => week.includes(r.date)).reduce((s, r) => s + r.minutes, 0);
  const recent = [...data.recovery].reverse().slice(0, 5);

  return (
    <div className="space-y-6 lg:space-y-8">
      <header>
        <div className="eyebrow">Restore</div>
        <h1 className="mt-2 font-display text-4xl font-light sm:text-5xl">Rest is training too</h1>
      </header>

      <section data-stage="dusk" style={stageStyle("dusk")} className="relative overflow-hidden rounded-[32px] border border-line">
        <div className="grid [&>*]:min-w-0 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)]">
          <div className="h-[340px] sm:h-[400px] lg:order-2 lg:h-[500px]">
            <RestoreScene active={!covered} className="h-full w-full" />
          </div>
          <div className="flex flex-col items-center justify-center gap-5 px-6 pb-8 pt-2 text-center lg:order-1 lg:items-start lg:gap-6 lg:py-12 lg:pl-12 lg:pr-4 lg:text-left">
            <div>
              <div className="font-display text-4xl leading-tight sm:text-5xl">Yoga nidra</div>
              <div className="mt-2 text-sm text-ink-soft">
                {t.recovered ? "Completed today" : `${whenLabel(profile.recoveryTime)} · ${countdown(nextAt(profile.recoveryTime))}`}
              </div>
            </div>
            <div className="flex gap-2">
              {LENGTHS.map((m) => (
                <Chip key={m} active={minutes === m} onClick={() => setMinutes(m)} className={minutes === m ? "" : "border-white/60 bg-white/50 backdrop-blur"}>
                  {m} min
                </Chip>
              ))}
            </div>
            <div className="flex flex-wrap justify-center gap-3">
              <Button size="lg" icon={Play} onClick={() => open({ recovery: { minutes } })}>
                Begin
              </Button>
              {ai.live ? (
                <Button size="lg" variant="outline" icon={Mic} onClick={() => open({ recovery: { minutes, live: true } })} className="border-white/60 bg-white/50 backdrop-blur">
                  Talk live
                </Button>
              ) : null}
            </div>
            {!t.recovered ? (
              <button
                type="button"
                onClick={() => {
                  actions.snoozeRecovery(30);
                  toast("We'll remind you in 30 min");
                }}
                className="text-sm text-ink/50 hover:text-ink"
              >
                Remind me later
              </button>
            ) : null}
          </div>
        </div>
      </section>

      <div className="grid gap-4 [&>*]:min-w-0 md:grid-cols-2 lg:gap-6">
        <Card>
          <div className="eyebrow">This week</div>
          <div className="mt-3 flex items-baseline gap-1.5">
            <span className="font-display text-4xl tabular-nums">{weekMinutes}</span>
            <span className="text-sm text-ink-faint">minutes of rest</span>
          </div>
          <div className="mt-5 flex justify-between">
            {week.map((key) => {
              const mins = data.recovery.filter((r) => r.date === key).reduce((s, r) => s + r.minutes, 0);
              return (
                <div key={key} className="flex flex-col items-center gap-2">
                  <span
                    className="grid h-8 w-8 place-items-center rounded-full text-[11px] font-semibold transition-colors duration-500"
                    style={{ background: mins ? "#b5a5bb" : "var(--surface-2)", color: mins ? "white" : "var(--ink-faint)" }}
                  >
                    {mins || ""}
                  </span>
                  <span className="text-xs text-ink-faint">{weekdayShort(key)}</span>
                </div>
              );
            })}
          </div>
        </Card>
        <Card>
          <div className="eyebrow">Recent</div>
          {recent.length ? (
            <ul className="mt-3 divide-y divide-line">
              {recent.map((r) => (
                <li key={r.id} className="flex justify-between py-2.5 text-sm">
                  <span>{r.kind === "live" ? "Live session" : "Yoga nidra"}</span>
                  <span className="text-ink-faint">
                    {r.minutes} min · {weekdayShort(r.date)} {formatClock(r.at)}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-3 text-sm text-ink-soft">Your first session will show here.</p>
          )}
        </Card>
      </div>
    </div>
  );
}
