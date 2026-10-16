"use client";

import { AnimatePresence, LayoutGroup, motion, MotionConfig, MotionGlobalConfig } from "framer-motion";
import { BarChart3, Dumbbell, Home, Leaf, Moon, Settings2, type LucideIcon } from "lucide-react";
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

import { SwasthyaWordmark } from "@/components/brand";
import { CoachSheet } from "@/components/overlays/coach";
import { MealCapture } from "@/components/overlays/meal-capture";
import { RecoverySession } from "@/components/overlays/recovery-session";
import { SettingsSheet } from "@/components/overlays/settings";
import { SquatTracker } from "@/components/overlays/squat-tracker";
import { WorkoutPlayer } from "@/components/overlays/workout-player";
import { preloadCharacters } from "@/components/three";
import { calm, fade, IconButton, Toast } from "@/components/ui";
import { BreathingTide, Illustration } from "@/components/visuals";
import { MoveView } from "@/components/views/move";
import { NourishView } from "@/components/views/nourish";
import { Onboarding } from "@/components/views/onboarding";
import { ProgressView } from "@/components/views/progress";
import { RestoreView } from "@/components/views/restore";
import { TodayView } from "@/components/views/today";
import { actions, useData } from "@/lib/store";
import type { AiStatus, AppData, Tab } from "@/lib/types";
import { cn, dateKey } from "@/lib/utils";

type Overlay = null | "camera" | "squats" | "coach" | "settings" | "workout" | { recovery: { minutes: number; live?: boolean } };

interface Ctx {
  data: AppData;
  tab: Tab;
  go: (tab: Tab) => void;
  open: (overlay: Overlay) => void;
  toast: (message: string) => void;
  ai: AiStatus;
  /** True while a sheet covers the page: background character and bowl scenes pause. */
  covered: boolean;
}

const AppContext = createContext<Ctx | null>(null);

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useApp outside provider");
  return ctx;
}

const NAV: { id: Tab; label: string; icon: LucideIcon }[] = [
  { id: "today", label: "Today", icon: Home },
  { id: "nourish", label: "Nourish", icon: Leaf },
  { id: "move", label: "Move", icon: Dumbbell },
  { id: "restore", label: "Restore", icon: Moon },
  { id: "progress", label: "Progress", icon: BarChart3 },
];

// Dev-only: `?forcerender` (automated visual checks in hidden tabs) completes UI animations instantly.
if (process.env.NODE_ENV !== "production" && typeof window !== "undefined" && window.location.search.includes("forcerender")) {
  MotionGlobalConfig.skipAnimations = true;
}

export function App() {
  const data = useData();
  const [tab, setTab] = useState<Tab>("today");
  const [overlay, setOverlay] = useState<Overlay>(null);
  const [toastMsg, setToastMsg] = useState<{ id: number; text: string } | null>(null);
  const [ai, setAi] = useState<AiStatus>({ ai: false, live: false });
  const [day, setDay] = useState(() => dateKey());

  // "Today" is derived at render time; re-render when the date rolls over (tab left open, laptop wakes).
  useEffect(() => {
    const check = () => setDay(dateKey());
    const t = setInterval(check, 60_000);
    document.addEventListener("visibilitychange", check);
    return () => {
      clearInterval(t);
      document.removeEventListener("visibilitychange", check);
    };
  }, []);

  useEffect(() => {
    fetch("/api/status")
      .then((r) => (r.ok ? r.json() : null))
      .then((s: AiStatus | null) => s && setAi(s))
      .catch(() => undefined);
  }, []);

  // Warm the small character stills once the page is idle.
  useEffect(() => {
    const w = window as Window & { requestIdleCallback?: (cb: () => void) => number };
    const run = () => preloadCharacters();
    if (w.requestIdleCallback) w.requestIdleCallback(run);
    else setTimeout(run, 1200);
  }, []);

  const go = useCallback((next: Tab) => {
    setTab(next);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, []);
  const close = useCallback(() => setOverlay(null), []);
  const toast = useCallback((text: string) => setToastMsg({ id: Date.now(), text }), []);
  const clearToast = useCallback(() => setToastMsg(null), []);

  const ctx = useMemo<Ctx | null>(
    () => (data ? { data, tab, go, open: setOverlay, toast, ai, covered: overlay !== null } : null),
    // `day` refreshes every consumer after midnight.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [data, tab, go, toast, ai, overlay, day],
  );

  return (
    <MotionConfig reducedMotion="user">
      {/* No exit animations here: screens swap instantly and the new one fades in. */}
      <AnimatePresence initial={false}>
        {!data ? (
          <div key="splash" className="grid min-h-dvh place-items-center">
            <SwasthyaWordmark className="opacity-70" />
          </div>
        ) : !data.profile ? (
          <motion.div key="onboarding" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={fade}>
            <Onboarding />
          </motion.div>
        ) : (
          <motion.div key="app" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={fade}>
            <AppContext.Provider value={ctx}>
              <Shell tab={tab} go={go} openOverlay={setOverlay} />
              <Overlays overlay={overlay} close={close} />
              <Toast message={toastMsg} onDone={clearToast} />
            </AppContext.Provider>
          </motion.div>
        )}
      </AnimatePresence>
    </MotionConfig>
  );
}

function Shell({ tab, go, openOverlay }: { tab: Tab; go: (t: Tab) => void; openOverlay: (o: Overlay) => void }) {
  return (
    <div className="min-h-dvh lg:pl-[260px]">
      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-[260px] flex-col border-r border-line bg-[rgba(251,250,246,0.6)] px-5 py-7 backdrop-blur-xl lg:flex">
        <SwasthyaWordmark className="px-3" />
        <LayoutGroup id="side">
          <nav className="mt-12 space-y-1">
            {NAV.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => go(item.id)}
                className={cn(
                  "relative flex h-11 w-full items-center gap-3 rounded-2xl px-3 text-[15px] font-medium",
                  tab === item.id ? "text-ink" : "text-ink-soft hover:text-ink",
                )}
              >
                {tab === item.id ? (
                  <motion.span layoutId="side-pill" transition={calm} className="absolute inset-0 rounded-2xl bg-surface-2" />
                ) : null}
                <item.icon className="relative h-[18px] w-[18px]" strokeWidth={1.8} />
                <span className="relative">{item.label}</span>
              </button>
            ))}
          </nav>
        </LayoutGroup>
        <div className="mt-auto space-y-1">
          <button
            type="button"
            onClick={() => openOverlay("coach")}
            className="flex h-11 w-full items-center gap-3 rounded-2xl bg-moss px-4 text-[15px] font-medium text-white hover:bg-[#344f45]"
          >
            <Illustration kind="coach" className="h-8 w-6" />
            Ask coach
          </button>
          <button
            type="button"
            onClick={() => openOverlay("settings")}
            className="flex h-11 w-full items-center gap-3 rounded-2xl px-4 text-[15px] font-medium text-ink-soft hover:bg-surface-2 hover:text-ink"
          >
            <Settings2 className="h-[18px] w-[18px]" strokeWidth={1.8} />
            Settings
          </button>
        </div>
      </aside>

      {/* Mobile top bar */}
      <header className="sticky top-0 z-30 flex items-center justify-between bg-[rgba(244,241,234,0.82)] px-5 pb-2 pt-[max(0.75rem,env(safe-area-inset-top))] backdrop-blur-xl lg:hidden">
        <SwasthyaWordmark />
        <IconButton icon={Settings2} label="Settings" onClick={() => openOverlay("settings")} />
      </header>

      <main className="mx-auto w-full max-w-6xl px-5 pb-32 pt-4 sm:px-8 lg:px-12 lg:pb-16 lg:pt-12">
        <RecoveryNudge />
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={tab}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
          >
            {tab === "today" && <TodayView />}
            {tab === "nourish" && <NourishView />}
            {tab === "move" && <MoveView />}
            {tab === "restore" && <RestoreView />}
            {tab === "progress" && <ProgressView />}
          </motion.div>
        </AnimatePresence>
      </main>

      {/* Mobile tab bar */}
      <nav className="fixed inset-x-3 bottom-[max(0.75rem,env(safe-area-inset-bottom))] z-30 lg:hidden">
        <LayoutGroup id="bottom">
          <div className="mx-auto flex max-w-md items-center justify-between rounded-full border border-line bg-[rgba(251,250,246,0.86)] p-1.5 shadow-[var(--shadow-md)] backdrop-blur-xl">
            {NAV.map((item) => (
              <button
                key={item.id}
                type="button"
                aria-label={item.label}
                onClick={() => go(item.id)}
                className={cn(
                  "relative flex h-12 flex-1 flex-col items-center justify-center gap-0.5 rounded-full text-[10px] font-semibold",
                  tab === item.id ? "text-ink" : "text-ink-faint",
                )}
              >
                {tab === item.id ? (
                  <motion.span layoutId="bottom-pill" transition={calm} className="absolute inset-0 rounded-full bg-surface-2" />
                ) : null}
                <item.icon className="relative h-[18px] w-[18px]" strokeWidth={1.8} />
                <span className="relative">{item.label}</span>
              </button>
            ))}
            <motion.button
              type="button"
              aria-label="Ask coach"
              whileTap={{ scale: 0.92 }}
              onClick={() => openOverlay("coach")}
              className="ml-1 grid h-12 w-12 shrink-0 place-items-center rounded-full bg-moss text-white"
            >
              <Illustration kind="coach" className="h-10 w-8" />
            </motion.button>
          </div>
        </LayoutGroup>
      </nav>
    </div>
  );
}

/** Proactive moment: around the user's recovery time, gently offer the session. */
function RecoveryNudge() {
  const { data, open } = useApp();
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(t);
  }, []);

  const show = useMemo(() => {
    const p = data.profile;
    if (!p) return false;
    const today = new Date(now);
    const key = dateKey(today);
    if (data.recovery.some((r) => r.date === key)) return false;
    if (data.snoozedUntil && new Date(data.snoozedUntil).getTime() > now) return false;
    const [h, m] = p.recoveryTime.split(":").map(Number);
    const at = new Date(today);
    at.setHours(h, m, 0, 0);
    const diff = (now - at.getTime()) / 60000;
    return diff >= -10 && diff <= 120;
  }, [data, now]);

  return (
    <AnimatePresence initial={false}>
      {show ? (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: "auto" }}
          exit={{ opacity: 0, height: 0 }}
          transition={calm}
          className="overflow-hidden"
        >
          <div className="mb-6 flex flex-wrap items-center gap-4 rounded-[24px] bg-ink px-5 py-4 text-white sm:flex-nowrap">
            <span className="relative grid h-10 w-10 shrink-0 place-items-center">
              <BreathingTide />
            </span>
            <div className="min-w-0 flex-1">
              <div className="font-display text-lg leading-tight">Time to wind down</div>
              <div className="text-sm text-white/60">Your evening reset is ready.</div>
            </div>
            <div className="flex w-full gap-2 sm:w-auto">
              <button
                type="button"
                onClick={() => actions.snoozeRecovery(30)}
                className="h-10 flex-1 rounded-full px-4 text-sm font-semibold text-white/70 hover:bg-white/10 hover:text-white sm:flex-none"
              >
                Later
              </button>
              <button
                type="button"
                onClick={() => open({ recovery: { minutes: 10 } })}
                className="h-10 flex-1 rounded-full bg-white px-5 text-sm font-semibold text-ink sm:flex-none"
              >
                Begin
              </button>
            </div>
          </div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}

function Overlays({ overlay, close }: { overlay: Overlay; close: () => void }) {
  const { toast } = useApp();
  const recovery = overlay && typeof overlay === "object" ? overlay.recovery : null;

  return (
    <>
      <MealCapture open={overlay === "camera"} onClose={close} />
      <WorkoutPlayer open={overlay === "workout"} onClose={close} />
      <SquatTracker
        open={overlay === "squats"}
        onClose={close}
        onSave={(reps) => {
          actions.logReps(reps);
          toast(`${reps} squats logged`);
          close();
        }}
      />
      <RecoverySession open={Boolean(recovery)} minutes={recovery?.minutes ?? 10} live={recovery?.live} onClose={close} />
      <CoachSheet open={overlay === "coach"} onClose={close} />
      <SettingsSheet open={overlay === "settings"} onClose={close} />
    </>
  );
}
