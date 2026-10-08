"use client";

import { Mic, Play } from "lucide-react";
import { useState } from "react";

import { useApp } from "@/components/app";
import { Button, Card, Chip, ImageSlot } from "@/components/ui";
import { IMAGES } from "@/lib/images";
import { LENGTHS } from "@/lib/recovery";
import { actions, todayOf } from "@/lib/store";
import { countdown, formatClock, formatTime, lastNDays, nextAt, weekdayShort } from "@/lib/utils";

export function RestoreView() {
  const { data, open, ai, toast } = useApp();
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

      <ImageSlot src={IMAGES.restore} tone="dusk" className="min-h-[380px]">
        <div className="flex h-full min-h-[380px] flex-col items-center justify-center gap-8 p-6 text-center sm:p-10">
          <div className="relative grid h-36 w-36 place-items-center">
            <span className="absolute inset-0 rounded-full bg-white/30" style={{ animation: "breathe 10s ease-in-out infinite" }} />
            <span className="absolute inset-6 rounded-full bg-white/50" style={{ animation: "breathe 10s ease-in-out infinite 0.4s" }} />
            <span className="absolute inset-12 rounded-full bg-white/80" />
          </div>
          <div>
            <div className="font-display text-3xl">Yoga nidra</div>
            <div className="mt-1 text-sm text-ink/60">
              {t.recovered ? "Completed today" : `Tonight at ${formatTime(profile.recoveryTime)} · ${countdown(nextAt(profile.recoveryTime))}`}
            </div>
          </div>
          <div className="flex gap-2">
            {LENGTHS.map((m) => (
              <Chip key={m} active={minutes === m} onClick={() => setMinutes(m)} className={minutes === m ? "" : "border-white/50 bg-white/40 backdrop-blur"}>
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
      </ImageSlot>

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
