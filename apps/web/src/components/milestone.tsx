"use client";

import { AnimatePresence, motion } from "framer-motion";
import { X } from "lucide-react";
import { useState } from "react";

import { friendAsset } from "@/components/characters/assets";
import { CharacterPlayer } from "@/components/characters/player";
import { calm } from "@/components/ui";

const MILESTONES = [3, 7, 14, 21, 30, 50, 100];
const SEEN_KEY = "swasthya:milestone-seen";

const LINES: Record<number, string> = {
  3: "Three days in a row. A rhythm is forming.",
  7: "A full week. This is becoming yours.",
  14: "Two weeks of showing up. Quietly impressive.",
  21: "Three weeks. Habits are built just like this.",
  30: "A month of care. Take a moment to notice it.",
  50: "Fifty days. Steady, kind, consistent.",
  100: "One hundred days. Thank you for showing up for yourself.",
};

/** A once-per-milestone celebration with both friends in their happy pose. */
export function Milestone({ streak }: { streak: number }) {
  // Today renders only on the client (after local data loads), so storage is readable here.
  const [seen, setSeen] = useState(() => {
    try {
      return Number(window.localStorage.getItem(SEEN_KEY)) || 0;
    } catch {
      return 0; // without storage the card simply shows again next visit
    }
  });

  const show = MILESTONES.includes(streak) && streak > seen;

  function dismiss() {
    setSeen(streak);
    try {
      window.localStorage.setItem(SEEN_KEY, String(streak));
    } catch {
      /* ignore */
    }
  }

  return (
    <AnimatePresence initial={false}>
      {show ? (
        <motion.section
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: "auto" }}
          exit={{ opacity: 0, height: 0 }}
          transition={calm}
          className="overflow-hidden"
          aria-label={`${streak}-day streak`}
        >
          <div className="relative flex items-center gap-4 rounded-[28px] bg-clay-soft px-5 py-4 sm:gap-6 sm:px-7">
            <div className="flex shrink-0 items-end">
              {(["man", "woman"] as const).map((who) => (
                <CharacterPlayer key={who} blendPlate poster={friendAsset(who, "happy")} aspectRatio={370 / 640} className="h-24 w-14 sm:h-28 sm:w-16" />
              ))}
            </div>
            <div className="min-w-0 flex-1">
              <div className="eyebrow text-[#8a6440]">{streak}-day streak</div>
              <p className="mt-1 font-display text-xl leading-snug sm:text-2xl">{LINES[streak]}</p>
            </div>
            <button
              type="button"
              onClick={dismiss}
              aria-label="Dismiss"
              className="grid h-9 w-9 shrink-0 place-items-center self-start rounded-full text-[#8a6440] hover:bg-white/40"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </motion.section>
      ) : null}
    </AnimatePresence>
  );
}
