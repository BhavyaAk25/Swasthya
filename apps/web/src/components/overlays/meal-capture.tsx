"use client";

import { AnimatePresence, motion } from "framer-motion";
import { Camera, ImagePlus, Minus, Plus, Search, Sparkles } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { useApp } from "@/components/app";
import { Button, calm, Chip, Sheet } from "@/components/ui";
import { estimateFromItems, searchFoods, type Food } from "@/lib/foods";
import { actions } from "@/lib/store";
import type { MealEstimate } from "@/lib/types";
import { cn, readFileAsDataUrl, shrinkImage } from "@/lib/utils";

type Phase = "capture" | "analyzing" | "review" | "pick";
const PORTIONS = [0.5, 1, 1.5, 2];

export function MealCapture({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <Sheet open={open} onClose={onClose} title="Log a meal">
      <Flow onClose={onClose} />
    </Sheet>
  );
}

function Flow({ onClose }: { onClose: () => void }) {
  const { ai, toast } = useApp();
  const [phase, setPhase] = useState<Phase>("capture");
  const [photo, setPhoto] = useState<string | null>(null);
  const [estimate, setEstimate] = useState<MealEstimate | null>(null);
  const [portion, setPortion] = useState(1);
  const [name, setName] = useState("");
  const [notice, setNotice] = useState<string | null>(null);
  const [picked, setPicked] = useState<{ food: Food; qty: number }[]>([]);

  const analyze = useCallback(
    async (raw: string) => {
      const image = await shrinkImage(raw, 1024, 0.82).catch(() => raw);
      setPhoto(image);
      if (!ai.ai) {
        setNotice(null);
        setPhase("pick");
        return;
      }
      setPhase("analyzing");
      try {
        const res = await fetch("/api/meal", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ image }),
        });
        const body = await res.json().catch(() => null);
        if (!res.ok || typeof body?.calories !== "number") throw new Error(body?.error ?? "failed");
        setEstimate(body as MealEstimate);
        setName((body as MealEstimate).name);
        setPortion(1);
        setPhase("review");
      } catch {
        setNotice("Couldn't read the photo. Pick what's on the plate.");
        setPhase("pick");
      }
    },
    [ai.ai],
  );

  async function save(meal: MealEstimate, source: "photo" | "quick") {
    const thumb = photo ? await shrinkImage(photo, 320, 0.7).catch(() => undefined) : undefined;
    actions.addMeal({ ...meal, source: photo ? "photo" : source, photo: thumb });
    toast(`Logged ${meal.name}`);
    onClose();
  }

  const pickedEstimate = useMemo(() => (picked.length ? estimateFromItems(picked) : null), [picked]);

  return (
    <AnimatePresence mode="wait" initial={false}>
      <motion.div
        key={phase}
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -6 }}
        transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
      >
        {phase === "capture" && <Capture onImage={analyze} onManual={() => setPhase("pick")} />}

        {phase === "analyzing" && photo && (
          <div className="space-y-5">
            <div className="relative overflow-hidden rounded-[24px]">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={photo} alt="Your meal" className="aspect-[4/3] w-full object-cover" />
              <motion.div
                className="absolute inset-0 bg-gradient-to-r from-transparent via-white/40 to-transparent"
                animate={{ x: ["-100%", "100%"] }}
                transition={{ duration: 1.6, repeat: Infinity, ease: "easeInOut" }}
              />
            </div>
            <div className="flex items-center justify-center gap-2 text-sm text-ink-soft">
              <Sparkles className="h-4 w-4 text-sage" /> Looking at your plate
            </div>
          </div>
        )}

        {phase === "review" && estimate && (
          <div className="space-y-5">
            {photo ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={photo} alt="Your meal" className="aspect-[16/10] w-full rounded-[24px] object-cover" />
            ) : null}
            <div>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={60}
                aria-label="Meal name"
                className="w-full bg-transparent font-display text-2xl outline-none"
              />
              <div className="mt-1 text-sm text-ink-soft">{estimate.items.join(" · ")}</div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Tile label="Calories" value={Math.round(estimate.calories * portion)} unit="kcal" />
              <Tile label="Protein" value={Math.round(estimate.protein * portion)} unit="g" />
            </div>
            <div>
              <div className="eyebrow">Portion</div>
              <div className="mt-3 flex gap-2">
                {PORTIONS.map((p) => (
                  <Chip key={p} active={portion === p} onClick={() => setPortion(p)} className="flex-1">
                    {p === 0.5 ? "½" : p === 1.5 ? "1½" : p}×
                  </Chip>
                ))}
              </div>
            </div>
            <p className="text-xs text-ink-faint">
              {estimate.confidence === "low" ? "Low confidence. " : ""}
              {estimate.note} Estimates only.
            </p>
            <div className="flex gap-3">
              <Button variant="outline" onClick={() => setPhase("pick")}>
                Edit items
              </Button>
              <Button
                className="flex-1"
                onClick={() =>
                  void save(
                    {
                      ...estimate,
                      name: name.trim() || estimate.name,
                      calories: Math.round(estimate.calories * portion),
                      protein: Math.round(estimate.protein * portion),
                      items: portion === 1 ? estimate.items : [...estimate.items, `${portion}× portion`],
                    },
                    "photo",
                  )
                }
              >
                Log meal
              </Button>
            </div>
          </div>
        )}

        {phase === "pick" && (
          <Picker
            photo={photo}
            notice={notice ?? (photo && !ai.ai ? "Offline mode. Pick what's on the plate." : null)}
            picked={picked}
            setPicked={setPicked}
            estimate={pickedEstimate}
            onSave={(e) => void save(e, "quick")}
          />
        )}
      </motion.div>
    </AnimatePresence>
  );
}

function Tile({ label, value, unit }: { label: string; value: number; unit: string }) {
  return (
    <div className="rounded-[20px] bg-surface-2 px-4 py-3">
      <div className="eyebrow">{label}</div>
      <div className="mt-1 flex items-baseline gap-1">
        <motion.span key={value} initial={{ opacity: 0.4 }} animate={{ opacity: 1 }} className="font-display text-3xl tabular-nums">
          {value}
        </motion.span>
        <span className="text-sm text-ink-faint">{unit}</span>
      </div>
    </div>
  );
}

function Capture({ onImage, onManual }: { onImage: (dataUrl: string) => void; onManual: () => void }) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);
  const [state, setState] = useState<"starting" | "ready" | "unavailable">("starting");

  useEffect(() => {
    let stream: MediaStream | null = null;
    let cancelled = false;

    (async () => {
      if (!navigator.mediaDevices?.getUserMedia) return setState("unavailable");
      const attempts: MediaStreamConstraints[] = [
        { video: { facingMode: { ideal: "environment" }, width: { ideal: 1280 }, height: { ideal: 960 } }, audio: false },
        { video: true, audio: false },
      ];
      for (const c of attempts) {
        try {
          stream = await navigator.mediaDevices.getUserMedia(c);
          if (cancelled) {
            stream.getTracks().forEach((t) => t.stop());
            return;
          }
          if (videoRef.current) {
            videoRef.current.srcObject = stream;
            await videoRef.current.play().catch(() => undefined);
          }
          setState("ready");
          return;
        } catch {
          // try next
        }
      }
      if (!cancelled) setState("unavailable");
    })();

    return () => {
      cancelled = true;
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  function snap() {
    const v = videoRef.current;
    if (!v || !v.videoWidth) return;
    const canvas = document.createElement("canvas");
    canvas.width = v.videoWidth;
    canvas.height = v.videoHeight;
    canvas.getContext("2d")?.drawImage(v, 0, 0);
    onImage(canvas.toDataURL("image/jpeg", 0.9));
  }

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || !file.type.startsWith("image/")) return;
    onImage(await readFileAsDataUrl(file));
  }

  return (
    <div className="space-y-4">
      <div className="relative aspect-[4/3] overflow-hidden rounded-[24px] bg-surface-2">
        <video
          ref={videoRef}
          playsInline
          muted
          className={cn("absolute inset-0 h-full w-full object-cover transition-opacity duration-700", state === "ready" ? "opacity-100" : "opacity-0")}
        />
        {state !== "ready" ? (
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-ink-soft hover:text-ink"
          >
            <span className="grid h-14 w-14 place-items-center rounded-full bg-surface">
              <ImagePlus className="h-6 w-6" strokeWidth={1.6} />
            </span>
            <span className="text-sm">{state === "starting" ? "Opening camera…" : "Choose a photo"}</span>
          </button>
        ) : (
          <div className="pointer-events-none absolute inset-6 rounded-[18px] border border-white/40" />
        )}
      </div>
      <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={onFile} />
      <div className="flex gap-3">
        <Button variant="outline" icon={ImagePlus} onClick={() => fileRef.current?.click()}>
          Upload
        </Button>
        <Button className="flex-1" icon={Camera} onClick={snap} disabled={state !== "ready"}>
          Capture
        </Button>
      </div>
      <button type="button" onClick={onManual} className="w-full py-1 text-center text-sm text-ink-faint hover:text-ink">
        No photo? Pick foods instead
      </button>
    </div>
  );
}

function Picker({
  photo,
  notice,
  picked,
  setPicked,
  estimate,
  onSave,
}: {
  photo: string | null;
  notice: string | null;
  picked: { food: Food; qty: number }[];
  setPicked: React.Dispatch<React.SetStateAction<{ food: Food; qty: number }[]>>;
  estimate: MealEstimate | null;
  onSave: (e: MealEstimate) => void;
}) {
  const [query, setQuery] = useState("");
  const results = searchFoods(query);

  function change(food: Food, delta: number) {
    setPicked((list) => {
      const found = list.find((i) => i.food.id === food.id);
      if (!found) return delta > 0 ? [...list, { food, qty: 1 }] : list;
      const step = (delta < 0 ? found.qty <= 1 : found.qty < 1) ? 0.5 : 1;
      const qty = Math.max(0, found.qty + delta * step);
      return qty <= 0 ? list.filter((i) => i.food.id !== food.id) : list.map((i) => (i.food.id === food.id ? { ...i, qty } : i));
    });
  }

  return (
    <div className="space-y-5">
      {photo ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={photo} alt="Your meal" className="aspect-[16/9] w-full rounded-[24px] object-cover" />
      ) : null}
      {notice ? <p className="text-sm text-ink-soft">{notice}</p> : null}

      <div className="flex items-center gap-3 rounded-full border border-line bg-bg px-4 focus-within:border-sage">
        <Search className="h-4 w-4 text-ink-faint" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search foods"
          className="h-11 min-w-0 flex-1 bg-transparent outline-none placeholder:text-ink-faint"
        />
      </div>
      <div className="flex flex-wrap gap-2">
        {results.map((f) => (
          <Chip key={f.id} active={picked.some((p) => p.food.id === f.id)} onClick={() => change(f, 1)}>
            {f.name}
          </Chip>
        ))}
        {results.length === 0 ? <span className="text-sm text-ink-faint">No match. Try a simpler word.</span> : null}
      </div>

      <AnimatePresence initial={false}>
        {picked.length ? (
          <motion.ul
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={calm}
            className="divide-y divide-line overflow-hidden rounded-[20px] bg-surface-2 px-4"
          >
            {picked.map(({ food, qty }) => (
              <li key={food.id} className="flex items-center gap-3 py-3">
                <div className="min-w-0 flex-1">
                  <div className="font-medium">{food.name}</div>
                  <div className="text-xs text-ink-faint">
                    {food.serving} · {Math.round(food.calories * qty)} kcal
                  </div>
                </div>
                <button type="button" aria-label="Less" onClick={() => change(food, -1)} className="grid h-8 w-8 place-items-center rounded-full bg-surface hover:text-ink">
                  <Minus className="h-3.5 w-3.5" />
                </button>
                <span className="w-8 text-center text-sm tabular-nums">{qty}</span>
                <button type="button" aria-label="More" onClick={() => change(food, 1)} className="grid h-8 w-8 place-items-center rounded-full bg-surface hover:text-ink">
                  <Plus className="h-3.5 w-3.5" />
                </button>
              </li>
            ))}
          </motion.ul>
        ) : null}
      </AnimatePresence>

      <Button className="w-full" disabled={!estimate} onClick={() => estimate && onSave(estimate)}>
        {estimate ? `Log ${estimate.calories} kcal · ${estimate.protein}g protein` : "Pick at least one food"}
      </Button>
    </div>
  );
}
