"use client";

import { AnimatePresence, motion } from "framer-motion";
import { CameraOff, LoaderCircle, RotateCcw } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

import { Button, Sheet, calm, fade } from "@/components/ui";
import { cn } from "@/lib/utils";

/* ------------------------------------------------------------------ */
/* MediaPipe, loaded at runtime from a CDN                             */
/* ------------------------------------------------------------------ */

const VERSION = "0.10.32";
const BUNDLE = `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${VERSION}/vision_bundle.mjs`;
const WASM = `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${VERSION}/wasm`;
const MODEL =
  "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task";

type Landmark = { x: number; y: number; z?: number; visibility?: number };
type PoseResult = { landmarks?: Landmark[][] };
type Landmarker = {
  detectForVideo(video: HTMLVideoElement, timestampMs: number): PoseResult;
  close(): void;
};
type VisionModule = {
  FilesetResolver: { forVisionTasks(basePath: string): Promise<unknown> };
  PoseLandmarker: {
    createFromOptions(fileset: unknown, options: Record<string, unknown>): Promise<Landmarker>;
  };
};
type Assets = { vision: VisionModule; fileset: unknown; model: ArrayBuffer };

/**
 * The JS bundle, WASM fileset and model bytes are fetched once per page and cached here,
 * so reopening is quick. Each session still creates (and closes) its own landmarker.
 */
let assetsPromise: Promise<Assets> | null = null;

function loadAssets(): Promise<Assets> {
  if (!assetsPromise) {
    assetsPromise = (async () => {
      const vision = (await import(/* webpackIgnore: true */ /* turbopackIgnore: true */ BUNDLE)) as VisionModule;
      const [fileset, model] = await Promise.all([
        vision.FilesetResolver.forVisionTasks(WASM),
        fetch(MODEL).then((res) => {
          if (!res.ok) throw new Error(`Pose model failed to load (${res.status})`);
          return res.arrayBuffer();
        }),
      ]);
      return { vision, fileset, model };
    })().catch((err: unknown) => {
      assetsPromise = null; // allow a clean retry
      throw err;
    });
  }
  return assetsPromise;
}

async function createLandmarker({ vision, fileset, model }: Assets): Promise<Landmarker> {
  const options = (delegate: "GPU" | "CPU") => ({
    // Copy so the cached buffer is never detached by the WASM side.
    baseOptions: { modelAssetBuffer: new Uint8Array(model.slice(0)), delegate },
    runningMode: "VIDEO",
    numPoses: 1,
  });
  try {
    return await vision.PoseLandmarker.createFromOptions(fileset, options("GPU"));
  } catch {
    return vision.PoseLandmarker.createFromOptions(fileset, options("CPU"));
  }
}

/* ------------------------------------------------------------------ */
/* Pose geometry                                                       */
/* ------------------------------------------------------------------ */

const CONNECTIONS: Array<[number, number]> = [
  [11, 12],
  [11, 13],
  [13, 15],
  [12, 14],
  [14, 16],
  [11, 23],
  [12, 24],
  [23, 24],
  [23, 25],
  [24, 26],
  [25, 27],
  [26, 28],
  [27, 29],
  [28, 30],
  [27, 31],
  [28, 32],
];
const JOINTS = Array.from(new Set(CONNECTIONS.flat()));
const LOWER_BODY = [23, 24, 25, 26, 27, 28];

const visible = (p?: Landmark) => !!p && (p.visibility ?? 1) >= 0.3;

function drawPose(ctx: CanvasRenderingContext2D, w: number, h: number, lm: Landmark[]) {
  ctx.lineCap = "round";
  ctx.lineWidth = 3;
  ctx.strokeStyle = "rgba(255,255,255,0.85)";
  for (const [a, b] of CONNECTIONS) {
    const p = lm[a];
    const q = lm[b];
    if (!visible(p) || !visible(q)) continue;
    ctx.beginPath();
    ctx.moveTo(p.x * w, p.y * h);
    ctx.lineTo(q.x * w, q.y * h);
    ctx.stroke();
  }
  ctx.fillStyle = "#c69c74";
  for (const i of JOINTS) {
    const p = lm[i];
    if (!visible(p)) continue;
    ctx.beginPath();
    ctx.arc(p.x * w, p.y * h, 4.5, 0, Math.PI * 2);
    ctx.fill();
  }
}

function jointAngle(a?: Landmark, b?: Landmark, c?: Landmark) {
  if (!a || !b || !c) return 180;
  const ab = { x: a.x - b.x, y: a.y - b.y };
  const cb = { x: c.x - b.x, y: c.y - b.y };
  const cosine = (ab.x * cb.x + ab.y * cb.y) / Math.max(0.00001, Math.hypot(ab.x, ab.y) * Math.hypot(cb.x, cb.y));
  return (Math.acos(Math.min(1, Math.max(-1, cosine))) * 180) / Math.PI;
}

function averageKneeAngle(lm: Landmark[]) {
  return (jointAngle(lm[23], lm[25], lm[27]) + jointAngle(lm[24], lm[26], lm[28])) / 2;
}

function lowerBodyVisible(lm: Landmark[]) {
  const scores = LOWER_BODY.map((i) => lm[i]?.visibility ?? (lm[i] ? 1 : 0));
  return scores.reduce((s, v) => s + v, 0) / scores.length >= 0.5;
}

/* ------------------------------------------------------------------ */
/* Rep state machine                                                   */
/* ------------------------------------------------------------------ */

type Phase = "standing" | "descending" | "bottom_reached" | "ascending";
type Status = "loading" | "ready" | "error";

const STANDING = 162;
const BOTTOM = 104;
const ASCENT = 126;
const DESCENT = 145;

const START_CUE = "Stand tall to begin.";

function describeError(err: unknown) {
  const name = err instanceof DOMException || err instanceof Error ? err.name : "";
  if (name === "NotAllowedError" || name === "SecurityError") return "Camera access is blocked.";
  if (name === "NotFoundError" || name === "OverconstrainedError") return "No camera was found.";
  return "The squat counter couldn't start.";
}

/* ------------------------------------------------------------------ */
/* Component                                                           */
/* ------------------------------------------------------------------ */

export function SquatTracker({
  open,
  onClose,
  onSave,
}: {
  open: boolean;
  onClose: () => void;
  onSave: (reps: number) => void;
}) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const [status, setStatus] = useState<Status>("loading");
  const [error, setError] = useState<string | null>(null);
  const [reps, setReps] = useState(0);
  const [cue, setCue] = useState(START_CUE);
  const [attempt, setAttempt] = useState(0);

  const cueRef = useRef(START_CUE);
  const phaseRef = useRef<Phase>("standing");
  const stableRef = useRef(0);
  const angleRef = useRef<number | null>(null);
  const armedRef = useRef(false);

  // Reset the visible session whenever the sheet opens (state adjusted during render, not in an effect).
  const [wasOpen, setWasOpen] = useState(open);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) {
      setReps(0);
      setCue(START_CUE);
      setStatus("loading");
      setError(null);
    }
  }

  /** Only touches React state when the cue actually changes. */
  const say = useCallback((text: string) => {
    if (cueRef.current === text) return;
    cueRef.current = text;
    setCue(text);
  }, []);

  const resetMachine = useCallback(() => {
    phaseRef.current = "standing";
    stableRef.current = 0;
    angleRef.current = null;
    armedRef.current = false;
  }, []);

  useEffect(() => {
    if (!open) return;
    const video = videoRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!video || !canvas || !ctx) return;

    let dead = false;
    let stream: MediaStream | null = null;
    let detector: Landmarker | null = null;
    let raf = 0;
    let lastVideoTime = -1;

    cueRef.current = START_CUE;
    resetMachine();

    const release = () => {
      cancelAnimationFrame(raf);
      raf = 0;
      stream?.getTracks().forEach((t) => t.stop());
      stream = null;
      try {
        detector?.close();
      } catch {
        /* already closed */
      }
      detector = null;
      video.pause();
      video.srcObject = null;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    };

    const step = (lm: Landmark[]) => {
      if (!lowerBodyVisible(lm)) {
        stableRef.current = 0;
        say("Step back so your legs are in view.");
        return;
      }

      const raw = averageKneeAngle(lm);
      const angle = angleRef.current === null ? raw : angleRef.current * 0.7 + raw * 0.3;
      angleRef.current = angle;
      const phase = phaseRef.current;

      if (angle >= STANDING) {
        stableRef.current += 1;
        if (phase === "ascending" && armedRef.current && stableRef.current >= 3) {
          phaseRef.current = "standing";
          armedRef.current = false;
          setReps((r) => r + 1);
          say("Good rep. Reset tall and go again.");
        } else if (phase === "standing" && cueRef.current !== "Good rep. Reset tall and go again.") {
          say("Stand tall, then sit back into the squat.");
        }
      } else if (angle <= BOTTOM) {
        stableRef.current += 1;
        if ((phase === "descending" || phase === "standing") && stableRef.current >= 3) {
          phaseRef.current = "bottom_reached";
          armedRef.current = true;
          say("Depth reached. Drive back up.");
        }
      } else if (angle < DESCENT && phase === "standing") {
        stableRef.current += 1;
        if (stableRef.current >= 2) {
          phaseRef.current = "descending";
          say("Good. Keep sitting lower.");
        }
      } else if (angle > ASCENT && phase === "bottom_reached") {
        stableRef.current += 1;
        if (stableRef.current >= 2) {
          phaseRef.current = "ascending";
          say("Stand tall to finish the rep.");
        }
      } else {
        stableRef.current = 0;
        if (phase === "descending") say("Sit a little lower before standing.");
        else if (phase === "bottom_reached") say("Drive up with control.");
        else if (phase === "ascending") say("Keep rising. Finish tall.");
      }
    };

    const loop = () => {
      raf = requestAnimationFrame(loop);
      if (!detector || video.readyState < 2 || video.currentTime === lastVideoTime) return;
      lastVideoTime = video.currentTime;

      const w = video.videoWidth;
      const h = video.videoHeight;
      if (!w || !h) return;
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w;
        canvas.height = h;
      }

      let result: PoseResult;
      try {
        result = detector.detectForVideo(video, performance.now());
      } catch {
        return;
      }

      ctx.clearRect(0, 0, w, h);
      const lm = result.landmarks?.[0];
      if (lm?.length) {
        drawPose(ctx, w, h, lm);
        step(lm);
      } else {
        stableRef.current = 0;
      }
    };

    const start = async () => {
      try {
        if (!navigator.mediaDevices?.getUserMedia) {
          throw Object.assign(new Error("Camera unavailable"), { name: "NotFoundError" });
        }
        const [s, assets] = await Promise.all([
          navigator.mediaDevices
            .getUserMedia({
              video: { facingMode: "user", width: { ideal: 960 }, height: { ideal: 720 } },
              audio: false,
            })
            .then((s) => {
              stream = s;
              // Closed or failed while the permission prompt was up: stop the late stream.
              if (dead) release();
              return s;
            }),
          loadAssets(),
        ]);
        if (dead) return;

        video.srcObject = s;
        await video.play();
        if (dead) return;

        detector = await createLandmarker(assets);
        if (dead) {
          release();
          return;
        }

        setStatus("ready");
        raf = requestAnimationFrame(loop);
      } catch (err) {
        if (dead) return;
        dead = true;
        release();
        setError(describeError(err));
        setStatus("error");
      }
    };

    void start();

    return () => {
      dead = true;
      release();
    };
  }, [open, attempt, say, resetMachine]);

  const retry = () => {
    setError(null);
    setStatus("loading");
    setAttempt((n) => n + 1);
  };

  const reset = () => {
    resetMachine();
    setReps(0);
    say(START_CUE);
  };

  const footer = (
    <div className="flex items-center justify-between gap-3">
      <Button variant="outline" icon={RotateCcw} onClick={reset} disabled={reps === 0}>
        Reset
      </Button>
      <Button onClick={() => onSave(reps)} disabled={reps === 0}>
        {reps === 0 ? "Save reps" : `Save ${reps} ${reps === 1 ? "rep" : "reps"}`}
      </Button>
    </div>
  );

  return (
    <Sheet open={open} onClose={onClose} title="Squat counter" size="lg" footer={footer}>
      <div className="relative aspect-[4/3] w-full overflow-hidden rounded-[24px] bg-black">
        <video
          ref={videoRef}
          playsInline
          muted
          className="absolute inset-0 h-full w-full scale-x-[-1] object-cover"
        />
        <canvas
          ref={canvasRef}
          className="pointer-events-none absolute inset-0 h-full w-full scale-x-[-1] object-cover"
        />

        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-black/45 to-transparent" />

        <div className="pointer-events-none absolute bottom-4 left-5 sm:bottom-5 sm:left-6">
          <div className="text-[11px] font-medium uppercase tracking-[0.22em] text-white/60">Reps</div>
          <motion.div
            key={reps}
            initial={{ scale: reps === 0 ? 1 : 1.18, opacity: reps === 0 ? 1 : 0.6 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={calm}
            className="origin-bottom-left font-display text-[56px] leading-none text-white tabular-nums"
          >
            {reps}
          </motion.div>
        </div>

        <AnimatePresence>
          {status === "loading" ? (
            <motion.div
              key="loading"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={fade}
              className="absolute inset-0 grid place-items-center bg-black/35"
            >
              <div className="flex items-center gap-2.5 text-sm text-white/75">
                <LoaderCircle className="h-4 w-4 animate-spin" strokeWidth={1.8} />
                Warming up camera
              </div>
            </motion.div>
          ) : null}

          {status === "error" ? (
            <motion.div
              key="error"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={fade}
              className="absolute inset-0 grid place-items-center bg-surface-2 p-6"
            >
              <div className="max-w-xs text-center">
                <div className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-clay-soft text-ink-soft">
                  <CameraOff className="h-5 w-5" strokeWidth={1.8} />
                </div>
                <p className="mt-4 font-display text-xl text-ink">{error ?? "The squat counter couldn't start."}</p>
                <p className="mt-2 text-sm leading-relaxed text-ink-faint">
                  If camera permission is blocked, allow it in your browser&apos;s site settings.
                </p>
                <Button variant="soft" size="sm" icon={RotateCcw} onClick={retry} className="mt-5">
                  Try again
                </Button>
              </div>
            </motion.div>
          ) : null}
        </AnimatePresence>
      </div>

      <div className={cn("mt-4 min-h-6 text-center text-[15px] text-ink-soft", status === "error" && "invisible")}>
        <AnimatePresence mode="wait" initial={false}>
          <motion.p
            key={cue}
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
          >
            {cue}
          </motion.p>
        </AnimatePresence>
      </div>
    </Sheet>
  );
}
