"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useState } from "react";

import { useApp } from "@/components/app";
import { checkInHint } from "@/components/checkin";
import { Button, calm } from "@/components/ui";
import { ACTION_LABEL } from "@/lib/coach";
import { actions, checkInFor, coachContext, todayOf } from "@/lib/store";
import type { CoachNote as Note } from "@/lib/types";
import { dateKey } from "@/lib/utils";

const CACHE_KEY = "swasthya:coach-note";

function partOfDay(h = new Date().getHours()) {
  return h < 5 ? "night" : h < 12 ? "morning" : h < 17 ? "afternoon" : h < 22 ? "evening" : "night";
}

function readCache(sig: string): Note | null {
  try {
    const hit = JSON.parse(window.localStorage.getItem(CACHE_KEY) ?? "null") as { sig?: string; note?: Note } | null;
    return hit?.sig === sig && typeof hit.note?.text === "string" ? hit.note : null;
  } catch {
    return null;
  }
}

function writeCache(sig: string, note: Note) {
  try {
    window.localStorage.setItem(CACHE_KEY, JSON.stringify({ sig, note }));
  } catch {
    /* The note is a nicety; it simply refetches next time. */
  }
}

/**
 * One calm suggestion under the hero. A check-in rule (short sleep, low mood) wins because it can
 * lighten the plan; otherwise the AI coach writes a short note from today's numbers. Offline, the
 * card only appears for the rule.
 */
export function CoachNote() {
  const { data, ai, open } = useApp();
  const t = todayOf(data);
  const check = checkInFor(data);
  const hint = checkInHint(check);
  const rule = hint && !(hint.tone === "light" && t.day.adaptation) && !(hint.tone === "rest" && t.recovered) ? hint : null;

  // Refetch only when something the note talks about changes.
  const sig = [data.profile?.name, dateKey(), partOfDay(), t.day.status, t.day.completed.length, t.recovered, t.meals.length, check.sleep, check.mood].join("|");
  const [note, setNote] = useState<{ sig: string; note: Note } | null>(null);

  useEffect(() => {
    if (!ai.ai || rule) return;
    const cached = readCache(sig);
    if (cached) {
      setNote({ sig, note: cached });
      return;
    }
    const context = coachContext(data);
    if (!context) return;
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const res = await fetch("/api/note", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          signal: AbortSignal.any([controller.signal, AbortSignal.timeout(20000)]),
          body: JSON.stringify({ context, partOfDay: partOfDay() }),
        });
        const next = (await res.json().catch(() => null)) as Note | null;
        if (!res.ok || !next?.text) return;
        writeCache(sig, next);
        setNote({ sig, note: next });
      } catch {
        /* Stay quiet: no note is better than an error on the Today page. */
      }
    }, 900);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
    // `data` is read at fetch time; `sig` captures the parts that matter.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ai.ai, sig, Boolean(rule)]);

  const ai_ = !rule && note?.sig === sig ? note.note : null;
  const action = ai_?.action === "open_workout" && t.day.status === "done" ? null : ai_?.action ?? null;
  const shown = rule
    ? { key: rule.text, text: rule.text, label: rule.tone === "light" ? "Lighten today" : "5 min reset", run: () => (rule.tone === "light" ? actions.setAdaptation("low_energy") : open({ recovery: { minutes: 5 } })) }
    : ai_
      ? {
          key: ai_.text,
          text: ai_.text,
          label: action ? ACTION_LABEL[action] : null,
          run: () =>
            open(action === "open_camera" ? "camera" : action === "open_squats" ? "squats" : action === "open_workout" ? "workout" : { recovery: { minutes: 5 } }),
        }
      : null;

  return (
    <AnimatePresence initial={false}>
      {shown ? (
        <motion.div
          key={shown.key}
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: "auto" }}
          exit={{ opacity: 0, height: 0 }}
          transition={calm}
          className="overflow-hidden"
        >
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-[24px] bg-moss-soft/70 px-5 py-4">
            <p className="min-w-0 flex-1 text-sm text-moss">{shown.text}</p>
            {shown.label ? (
              <Button size="sm" variant="primary" onClick={shown.run}>
                {shown.label}
              </Button>
            ) : null}
          </div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
