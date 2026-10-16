"use client";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { useCallback, useEffect, useState } from "react";

import { CHARACTER_ASSETS, HERO_ENTRY_SECONDS, characterClipFor, friendAsset, type Friend } from "@/components/characters/assets";
import { CharacterPlayer } from "@/components/characters/player";
import { BreathingGuide } from "@/components/characters/breathing-guide";
import { VISUALS } from "@/lib/images";
import { cn } from "@/lib/utils";

type Mode = "idle" | "squat" | "happy";
const HINT_KEY = "swasthya:hero-hint-seen";
const REPS = 5;
const FRIENDS = ["man", "woman"] as const;

function RepDots({ count, mode }: { count: number; mode: Mode }) {
  return (
    <div className={cn("pointer-events-none flex justify-center gap-1.5 transition-opacity duration-500", mode === "idle" ? "opacity-0" : "opacity-100")} aria-hidden>
      {Array.from({ length: REPS }, (_, index) => (
        <span key={index} className={cn("h-2 w-2 rounded-full transition-colors duration-500", index < count ? "bg-moss" : "bg-ink/15", mode === "happy" && "bg-clay")} />
      ))}
    </div>
  );
}

function FriendFigure({ who, active, hint, onActivate, reduced }: { who: Friend; active: boolean; hint: boolean; onActivate: () => void; reduced: boolean }) {
  const [mode, setMode] = useState<Mode>("idle");
  const [reps, setReps] = useState(0);
  const [run, setRun] = useState(0);
  const unavailable = useCallback(() => { setReps(0); setMode("idle"); }, []);
  const left = who === "man";
  const activate = () => {
    onActivate();
    if (mode === "squat" && !reduced) return;
    setReps(reduced ? REPS : 0);
    setMode(reduced ? "happy" : "squat");
    setRun((value) => value + 1);
  };
  return (
    <button type="button" onClick={activate} className="relative h-full min-w-0 rounded-2xl text-left focus-visible:outline-2 focus-visible:outline-offset-[-3px] focus-visible:outline-moss" aria-label={`${left ? "Left" : "Right"} figure: five squats${mode === "squat" ? `, ${reps} of 5` : mode === "happy" ? ", complete; tap to replay" : ""}`}>
      <CharacterPlayer
        key={run}
        blendPlate
        aspectRatio={370 / 640}
        poster={friendAsset(who, mode === "happy" ? "happy" : "idle")}
        video={friendAsset(who, "squat")}
        active={active}
        playing={mode === "squat"}
        showVideo={mode === "squat"}
        loop={false}
        className="h-full w-full"
        onTime={(seconds) => setReps(Math.min(REPS, Math.max(0, Math.floor((seconds - HERO_ENTRY_SECONDS) / CHARACTER_ASSETS.squat.seconds))))}
        onDone={() => { setReps(REPS); setMode("happy"); }}
        onFailure={unavailable}
      />
      <div className="pointer-events-none absolute inset-x-0 top-3"><RepDots count={reps} mode={mode} /></div>
      {hint ? (
        <div className="pointer-events-none absolute right-[18%] top-[42%]" aria-hidden>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={VISUALS.hint} alt="" className="click-hint h-14 w-11" />
        </div>
      ) : null}
    </button>
  );
}

export function HeroScene({ className, active = true, label = "Two friends on yoga mats. Tap one to watch them train." }: { className?: string; active?: boolean; label?: string }) {
  const reduced = Boolean(useReducedMotion());
  const [hint, setHint] = useState(false);
  useEffect(() => {
    let seen = false;
    try { seen = window.localStorage.getItem(HINT_KEY) === "1"; } catch { /* Browser privacy settings can disable storage. */ }
    const timer = setTimeout(() => setHint(!seen), 1200);
    return () => clearTimeout(timer);
  }, []);
  const activate = () => {
    setHint(false);
    try { window.localStorage.setItem(HINT_KEY, "1"); } catch { /* Decorative interaction works without storage. */ }
  };
  return (
    <div className={cn("relative grid min-w-0 grid-cols-2 bg-bg", className)} role="group" aria-label={label}>
      {FRIENDS.map((who) => <FriendFigure key={who} who={who} active={active} reduced={reduced} hint={hint && !reduced && who === "woman"} onActivate={activate} />)}
    </div>
  );
}

export function ExerciseDemoScene({ exerciseId, playing = true, active = true, className }: { exerciseId: string; playing?: boolean; active?: boolean; className?: string }) {
  const selected = characterClipFor(exerciseId);
  const asset = CHARACTER_ASSETS[selected];
  // Moves cross-fade instead of cutting; the same move keeps one player, so pausing for rest
  // and resuming continues the clip without reloading it.
  return (
    <div className={cn("relative", className)}>
      <AnimatePresence initial={false}>
        <motion.div key={selected} className="absolute inset-0" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.45, ease: "easeInOut" }}>
          <CharacterPlayer poster={asset.poster} video={asset.video} active={active} playing={playing} className="h-full w-full" label={selected === "deadbug" ? "Dead bug: arms steady, alternating leg extensions." : `Demonstration: ${selected}`} />
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

export function RestoreScene({ cycle, playing = true, active = true, className }: { cycle?: number; playing?: boolean; active?: boolean; className?: string }) {
  const asset = CHARACTER_ASSETS.rest;
  return (
    <div className={cn("flex min-w-0 flex-col", className)}>
      <CharacterPlayer poster={asset.poster} video={asset.video} cycle={cycle} active={active} playing={playing} className="min-h-0 w-full flex-1" label="Two friends resting on their mats, breathing slowly." />
      <BreathingGuide cycle={cycle} playing={playing} active={active} className="shrink-0 pb-2" />
    </div>
  );
}
