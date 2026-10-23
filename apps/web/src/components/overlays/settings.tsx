"use client";

import { Download, RotateCcw, Upload } from "lucide-react";
import { useRef, useState } from "react";

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

const SWITCH =
  "h-5 w-9 shrink-0 cursor-pointer appearance-none rounded-full bg-surface-2 transition-colors before:block before:h-4 before:w-4 before:translate-x-0.5 before:rounded-full before:bg-white before:shadow before:transition-transform checked:bg-moss checked:before:translate-x-4.5";

const input = "h-12 w-full rounded-[16px] border border-line bg-bg px-4 outline-none focus:border-sage";

function Form({ onClose }: { onClose: () => void }) {
  const { data, ai, toast } = useApp();
  const [p, setP] = useState<Profile>(data.profile!);
  const [confirmReset, setConfirmReset] = useState(false);
  const fileInput = useRef<HTMLInputElement | null>(null);
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

      <label className="flex cursor-pointer items-center justify-between gap-4 rounded-[20px] border border-line px-4 py-3">
        <span className="min-w-0">
          <span className="block text-sm font-medium">Evening tones</span>
          <span className="block text-xs text-ink-faint">A warmer, softer palette from wind-down time.</span>
        </span>
        <input
          type="checkbox"
          role="switch"
          checked={p.eveningTones !== false}
          onChange={(e) => update("eveningTones", e.target.checked)}
          className={SWITCH}
        />
      </label>

      <label className="flex cursor-pointer items-center justify-between gap-4 rounded-[20px] border border-line px-4 py-3">
        <span className="min-w-0">
          <span className="block text-sm font-medium">Wind-down reminder</span>
          <span className="block text-xs text-ink-faint">A notification at {p.recoveryTime} while Swasthya is open in a tab.</span>
        </span>
        <input
          type="checkbox"
          role="switch"
          checked={Boolean(p.reminders)}
          onChange={async (e) => {
            const on = e.target.checked;
            if (on && typeof Notification !== "undefined" && Notification.permission !== "granted") {
              const result = await Notification.requestPermission().catch(() => "denied" as const);
              if (result !== "granted") {
                toast("Notifications are blocked for this site");
                return;
              }
            }
            update("reminders", on);
          }}
          className={SWITCH}
        />
      </label>

      <div>
        <div className="eyebrow">Your data</div>
        <p className="mt-1 text-xs text-ink-faint">Everything stays in this browser. Back up to move to another device.</p>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button variant="outline" size="sm" icon={Download} onClick={actions.exportBackup}>
          Back up
        </Button>
        <Button variant="outline" size="sm" icon={Upload} onClick={() => fileInput.current?.click()}>
          Restore
        </Button>
        <input
          ref={fileInput}
          type="file"
          accept="application/json,.json"
          className="hidden"
          onChange={async (e) => {
            const file = e.target.files?.[0];
            e.target.value = "";
            if (!file) return;
            const undo = actions.importBackup(await file.text());
            if (!undo) return toast("That file isn't a Swasthya backup");
            onClose();
            toast("Backup restored", undo);
          }}
        />
        <Button variant="ghost" size="sm" icon={Download} onClick={actions.exportCsv} disabled={!data.meals.length}>
          Meals CSV
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
