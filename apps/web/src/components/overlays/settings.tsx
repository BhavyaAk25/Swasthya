"use client";

import { Download, RotateCcw } from "lucide-react";
import { useState } from "react";

import { useApp } from "@/components/app";
import { Button, Chip, Sheet } from "@/components/ui";
import { GOALS, SPLITS } from "@/lib/plan";
import { actions } from "@/lib/store";
import type { Profile } from "@/lib/types";
import { cn } from "@/lib/utils";

export function SettingsSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <Sheet open={open} onClose={onClose} title="Settings">
      <Form onClose={onClose} />
    </Sheet>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="eyebrow">{label}</div>
      <div className="mt-3">{children}</div>
    </div>
  );
}

const input = "h-12 w-full rounded-[16px] border border-line bg-bg px-4 outline-none focus:border-sage";

function Form({ onClose }: { onClose: () => void }) {
  const { data, ai, toast } = useApp();
  const [p, setP] = useState<Profile>(data.profile!);
  const [confirmReset, setConfirmReset] = useState(false);
  const update = <K extends keyof Profile>(key: K, value: Profile[K]) => setP((cur) => ({ ...cur, [key]: value }));

  return (
    <div className="space-y-7">
      <Field label="Name">
        <input className={input} value={p.name} maxLength={40} onChange={(e) => update("name", e.target.value)} />
      </Field>
      <Field label="Focus">
        <div className="flex flex-wrap gap-2">
          {GOALS.map((g) => (
            <Chip key={g.id} active={p.goal === g.id} onClick={() => update("goal", g.id)}>
              {g.label}
            </Chip>
          ))}
        </div>
      </Field>
      <Field label="Training rhythm">
        <div className="flex flex-wrap gap-2">
          {SPLITS.map((s) => (
            <Chip key={s.id} active={p.split === s.id} onClick={() => update("split", s.id)}>
              {s.label}
            </Chip>
          ))}
        </div>
      </Field>
      <div className="grid grid-cols-3 gap-3">
        <Field label="Wind down">
          <input type="time" className={input} value={p.recoveryTime} onChange={(e) => e.target.value && update("recoveryTime", e.target.value)} />
        </Field>
        <Field label="kcal / day">
          <input
            type="number"
            inputMode="numeric"
            className={input}
            value={p.calorieTarget}
            min={800}
            max={6000}
            onChange={(e) => update("calorieTarget", Number(e.target.value) || 0)}
          />
        </Field>
        <Field label="Protein g">
          <input
            type="number"
            inputMode="numeric"
            className={input}
            value={p.proteinTarget}
            min={20}
            max={400}
            onChange={(e) => update("proteinTarget", Number(e.target.value) || 0)}
          />
        </Field>
      </div>

      <div className="flex items-center gap-3 rounded-[20px] bg-surface-2 px-4 py-3 text-sm">
        <span className={cn("h-2 w-2 shrink-0 rounded-full", ai.ai ? "bg-moss" : "bg-ink-faint")} />
        <span className="text-ink-soft">
          {ai.ai
            ? `AI is on via ${ai.provider === "groq" ? "Groq" : "Gemini"} for coach notes, chat and photo estimates${ai.live ? ", plus live voice" : ""}.`
            : "Offline mode. Add a free Groq or Gemini key to .env.local for coach notes, chat and photo estimates."}
        </span>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button variant="outline" size="sm" icon={Download} onClick={actions.exportCsv} disabled={!data.meals.length}>
          Export meals
        </Button>
        <Button
          variant="ghost"
          size="sm"
          icon={RotateCcw}
          className={cn(confirmReset && "bg-clay-soft text-[#8a6440]")}
          onClick={() => {
            if (!confirmReset) return setConfirmReset(true);
            onClose();
            actions.reset();
          }}
        >
          {confirmReset ? "Tap again to erase everything" : "Start over"}
        </Button>
      </div>

      <Button
        className="w-full"
        size="lg"
        disabled={!p.name.trim()}
        onClick={() => {
          actions.saveProfile({
            ...p,
            name: p.name.trim(),
            calorieTarget: Math.min(6000, Math.max(800, p.calorieTarget || 2000)),
            proteinTarget: Math.min(400, Math.max(20, p.proteinTarget || 100)),
          });
          toast("Saved");
          onClose();
        }}
      >
        Save
      </Button>
    </div>
  );
}
