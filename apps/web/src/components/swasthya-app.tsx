"use client";

import { GoogleGenAI, Modality, type LiveServerMessage, type Session } from "@google/genai";
import { AnimatePresence, motion } from "framer-motion";
import {
  Camera,
  Check,
  Dumbbell,
  LoaderCircle,
  Mic,
  RefreshCcw,
  Send,
  Sparkles,
  TimerReset,
  X,
} from "lucide-react";
import { startTransition, useCallback, useEffect, useMemo, useRef, useState } from "react";

import type {
  ApiResponse,
  AppState,
  ChatMessage,
  CoachAction,
  LiveBootstrapPayload,
  OnboardingInput,
} from "@/lib/types";
import { cn, minutesUntil } from "@/lib/utils";

type CameraMode = "meal" | "workout" | null;

type CoachEnvelope = {
  state: AppState;
  action: CoachAction;
};

const goalOptions = [
  "Build calm consistency",
  "Get stronger without overcomplicating it",
  "Recover and stay on track",
];

const splitOptions = ["Minimalist 3-Day", "Upper / Lower", "Full Body"];

async function fetchEnvelope<T>(url: string, options?: RequestInit): Promise<ApiResponse<T>> {
  try {
    const response = await fetch(url, options);
    const text = await response.text();
    let parsed: ApiResponse<T> | null = null;

    if (text) {
      try {
        parsed = JSON.parse(text) as ApiResponse<T>;
      } catch {
        return {
          ok: false,
          data: null,
          error: text || "The server returned an invalid response.",
        };
      }
    }

    if (!response.ok || !parsed?.ok) {
      return {
        ok: false,
        data: null,
        error: parsed?.error ?? "Something went wrong.",
      };
    }

    return parsed;
  } catch {
    return {
      ok: false,
      data: null,
      error: "Unable to reach the server.",
    };
  }
}

function Surface({
  children,
  className,
}: Readonly<{ children: React.ReactNode; className?: string }>) {
  return <div className={cn("surface-panel rounded-[28px] p-5", className)}>{children}</div>;
}

function StatusPill({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-full border border-[var(--line)] bg-white/75 px-4 py-2">
      <div className="text-[10px] uppercase tracking-[0.24em] text-[var(--muted)]">{label}</div>
      <div className="mt-1 text-sm font-semibold text-[var(--foreground)]">{value}</div>
    </div>
  );
}

function MessageBubble({ message }: { message: ChatMessage }) {
  const coach = message.role !== "user";
  return (
    <div className={cn("flex", coach ? "justify-start" : "justify-end")}>
      <div
        className={cn(
          "max-w-[82%] rounded-[24px] px-4 py-3 text-sm leading-6",
          coach ? "bg-white/82 text-[var(--foreground)]" : "bg-[var(--eucalyptus)] text-white",
        )}
      >
        <div>{message.content}</div>
      </div>
    </div>
  );
}

function SetupScreen({
  form,
  setForm,
  busy,
  onSubmit,
}: {
  form: OnboardingInput;
  setForm: React.Dispatch<React.SetStateAction<OnboardingInput>>;
  busy: boolean;
  onSubmit: () => void;
}) {
  return (
    <Surface className="space-y-5 rounded-[32px] bg-[linear-gradient(145deg,rgba(255,250,246,0.94),rgba(228,236,231,0.72))]">
      <div>
        <div className="text-[11px] uppercase tracking-[0.28em] text-[var(--muted)]">Swasthya</div>
        <div className="display-face mt-3 text-[2.5rem] leading-none text-[var(--foreground)]">Set the day up fast.</div>
      </div>
      <div className="space-y-4">
        <Field label="Name">
          <input
            value={form.displayName}
            onChange={(event) => setForm((current) => ({ ...current, displayName: event.target.value }))}
            className="w-full rounded-[22px] border border-[var(--line)] bg-white/85 px-4 py-4 outline-none"
          />
        </Field>
        <Field label="Goal">
          <div className="grid gap-2">
            {goalOptions.map((goal) => (
              <button
                key={goal}
                type="button"
                onClick={() => setForm((current) => ({ ...current, goal }))}
                className={cn(
                  "rounded-[22px] border px-4 py-3 text-left text-sm transition",
                  form.goal === goal ? "border-transparent bg-[rgba(69,100,94,0.12)]" : "border-[var(--line)] bg-white/75",
                )}
              >
                {goal}
              </button>
            ))}
          </div>
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Workout">
            <select
              value={form.workoutSplit}
              onChange={(event) => setForm((current) => ({ ...current, workoutSplit: event.target.value }))}
              className="w-full rounded-[22px] border border-[var(--line)] bg-white/85 px-4 py-4 outline-none"
            >
              {splitOptions.map((split) => (
                <option key={split}>{split}</option>
              ))}
            </select>
          </Field>
          <Field label="Recovery">
            <input
              type="time"
              value={form.recoveryTime}
              onChange={(event) => setForm((current) => ({ ...current, recoveryTime: event.target.value }))}
              className="w-full rounded-[22px] border border-[var(--line)] bg-white/85 px-4 py-4 outline-none"
            />
          </Field>
        </div>
      </div>
      <button
        type="button"
        onClick={onSubmit}
        className="flex w-full items-center justify-center gap-3 rounded-full bg-[var(--foreground)] px-5 py-4 text-sm font-semibold text-white"
      >
        {busy ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
        Start coaching
      </button>
    </Surface>
  );
}

function Field({
  label,
  children,
}: Readonly<{ label: string; children: React.ReactNode }>) {
  return (
    <label className="block space-y-2">
      <div className="text-[11px] uppercase tracking-[0.28em] text-[var(--muted)]">{label}</div>
      {children}
    </label>
  );
}

function MealDraftCard({
  state,
  clarification,
  setClarification,
  onLog,
  busy,
}: {
  state: AppState;
  clarification: string;
  setClarification: React.Dispatch<React.SetStateAction<string>>;
  onLog: () => void;
  busy: boolean;
}) {
  const draft = state.currentMealDraft;

  if (!draft) {
    return null;
  }

  return (
    <Surface className="space-y-4 bg-white/85">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-[11px] uppercase tracking-[0.24em] text-[var(--muted)]">Meal estimate</div>
          <div className="mt-2 text-lg font-semibold">{draft.foods.join(" · ")}</div>
        </div>
        <div className="rounded-full bg-[rgba(139,162,143,0.14)] px-3 py-2 text-xs font-semibold capitalize text-[var(--eucalyptus)]">
          {draft.confidence}
        </div>
      </div>
      {draft.imageDataUrl ? (
        <>
          {/* Deliberately using img for data URLs captured from the browser camera. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={draft.imageDataUrl} alt="Captured meal" className="h-52 w-full rounded-[24px] object-cover" />
        </>
      ) : null}
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-[20px] bg-[rgba(245,241,235,0.88)] p-4">
          <div className="text-[10px] uppercase tracking-[0.24em] text-[var(--muted)]">Calories</div>
          <div className="display-face mt-2 text-3xl">{draft.caloriesEstimate}</div>
        </div>
        <div className="rounded-[20px] bg-[rgba(245,241,235,0.88)] p-4">
          <div className="text-[10px] uppercase tracking-[0.24em] text-[var(--muted)]">Protein</div>
          <div className="display-face mt-2 text-3xl">{draft.proteinEstimate}g</div>
        </div>
      </div>
      <div className="rounded-[22px] bg-[rgba(245,241,235,0.88)] p-4">
        <div className="text-sm font-semibold">{draft.followUpQuestion}</div>
        <div className="mt-3 flex flex-wrap gap-2">
          {draft.quickAnswers.map((answer) => (
            <button
              key={answer}
              type="button"
              onClick={() => setClarification(answer)}
              className={cn(
                "rounded-full border px-3 py-2 text-sm transition",
                clarification === answer
                  ? "border-transparent bg-[var(--eucalyptus)] text-white"
                  : "border-[var(--line)] bg-white/90 text-[var(--foreground)]",
              )}
            >
              {answer}
            </button>
          ))}
        </div>
        <textarea
          value={clarification}
          onChange={(event) => setClarification(event.target.value)}
          className="mt-4 min-h-24 w-full rounded-[18px] border border-[var(--line)] bg-white/90 p-3 outline-none"
          placeholder="Optional clarification"
        />
      </div>
      <button
        type="button"
        onClick={onLog}
        className="flex w-full items-center justify-center gap-3 rounded-full bg-[var(--foreground)] px-5 py-3 text-sm font-semibold text-white"
      >
        {busy ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
        Log estimate
      </button>
    </Surface>
  );
}

function detectMobileDevice() {
  if (typeof navigator === "undefined") {
    return false;
  }

  return /android|iphone|ipad|ipod/i.test(navigator.userAgent);
}

function buildCameraConstraints(mode: Exclude<CameraMode, null>) {
  const desktopMealConstraints: MediaStreamConstraints[] = [
    {
      video: {
        width: { ideal: 1280 },
        height: { ideal: 720 },
      },
      audio: false,
    },
    {
      video: {
        facingMode: { ideal: "environment" },
        width: { ideal: 1280 },
        height: { ideal: 720 },
      },
      audio: false,
    },
    { video: true, audio: false },
  ];

  const mobileMealConstraints: MediaStreamConstraints[] = [
    {
      video: {
        facingMode: { ideal: "environment" },
        width: { ideal: 1280 },
        height: { ideal: 720 },
      },
      audio: false,
    },
    {
      video: {
        facingMode: "user",
        width: { ideal: 1280 },
        height: { ideal: 720 },
      },
      audio: false,
    },
    { video: true, audio: false },
  ];

  if (mode === "meal") {
    return detectMobileDevice() ? mobileMealConstraints : desktopMealConstraints;
  }

  return [
    {
      video: {
        facingMode: "user",
        width: { ideal: 960 },
        height: { ideal: 720 },
      },
      audio: false,
    },
    { video: true, audio: false },
  ];
}

function appendTranscriptLine(
  setTranscript: React.Dispatch<React.SetStateAction<{ user: string[]; coach: string[] }>>,
  role: "user" | "coach",
  text: string,
  lastValueRef: React.MutableRefObject<string>,
) {
  const normalized = text.trim();
  if (!normalized) {
    return;
  }

  setTranscript((current) => {
    const next = {
      user: [...current.user],
      coach: [...current.coach],
    };
    const lines = next[role];
    const previous = lastValueRef.current;

    if (previous && (normalized.startsWith(previous) || previous.startsWith(normalized))) {
      if (lines.length) {
        lines[lines.length - 1] = normalized;
      } else {
        lines.push(normalized);
      }
    } else if (lines.at(-1) !== normalized) {
      lines.push(normalized);
    }

    lastValueRef.current = normalized;
    return next;
  });
}

function floatTo16BitPcmBase64(input: Float32Array) {
  const buffer = new ArrayBuffer(input.length * 2);
  const view = new DataView(buffer);

  for (let index = 0; index < input.length; index += 1) {
    const sample = Math.max(-1, Math.min(1, input[index] ?? 0));
    view.setInt16(index * 2, sample < 0 ? sample * 0x8000 : sample * 0x7fff, true);
  }

  let binary = "";
  const bytes = new Uint8Array(buffer);
  for (const value of bytes) {
    binary += String.fromCharCode(value);
  }

  return btoa(binary);
}

function decodePcmBase64(base64: string) {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);

  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }

  return bytes;
}

function parseAudioMimeRate(mimeType?: string) {
  const match = mimeType?.match(/rate=(\d+)/i);
  return Number(match?.[1] ?? "24000");
}

async function playPcmChunk(
  audioContext: AudioContext,
  playbackCursorRef: React.MutableRefObject<number>,
  base64Data: string,
  mimeType?: string,
) {
  const bytes = decodePcmBase64(base64Data);
  const sampleCount = Math.floor(bytes.length / 2);
  const samples = new Float32Array(sampleCount);

  for (let index = 0; index < sampleCount; index += 1) {
    const low = bytes[index * 2] ?? 0;
    const high = bytes[index * 2 + 1] ?? 0;
    let value = low | (high << 8);
    if (value >= 0x8000) {
      value -= 0x10000;
    }
    samples[index] = value / 0x8000;
  }

  const sampleRate = parseAudioMimeRate(mimeType);
  const buffer = audioContext.createBuffer(1, samples.length, sampleRate);
  buffer.copyToChannel(samples, 0);

  const source = audioContext.createBufferSource();
  source.buffer = buffer;
  source.connect(audioContext.destination);
  const startAt = Math.max(audioContext.currentTime, playbackCursorRef.current);
  source.start(startAt);
  playbackCursorRef.current = startAt + buffer.duration;
}

function LiveCallOverlay({
  session,
  open,
  onClose,
  onDone,
  onSnooze,
}: {
  session: AppState["liveSession"];
  open: boolean;
  onClose: () => void;
  onDone: () => void;
  onSnooze: () => void;
}) {
  const [status, setStatus] = useState<AppState["liveSession"] extends { status: infer T } ? T : string>("idle");
  const [localError, setLocalError] = useState<string | null>(null);
  const [muted, setMuted] = useState(false);
  const [micLevel, setMicLevel] = useState(0);
  const [hasInputTranscript, setHasInputTranscript] = useState(false);
  const [transcript, setTranscript] = useState<{ user: string[]; coach: string[] }>({
    user: session?.transcript.user ?? [],
    coach: session?.transcript.coach ?? [],
  });
  const liveSessionRef = useRef<Session | null>(null);
  const inputAudioContextRef = useRef<AudioContext | null>(null);
  const outputAudioContextRef = useRef<AudioContext | null>(null);
  const micStreamRef = useRef<MediaStream | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const micMeterFrameRef = useRef<number | null>(null);
  const playbackCursorRef = useRef(0);
  const lastUserTranscriptRef = useRef("");
  const lastCoachTranscriptRef = useRef("");
  const mutedRef = useRef(false);
  const audioEndedRef = useRef(false);

  useEffect(() => {
    mutedRef.current = muted;
  }, [muted]);

  const teardownLiveSession = useCallback(() => {
    if (liveSessionRef.current && !audioEndedRef.current) {
      try {
        liveSessionRef.current.sendRealtimeInput({
          audioStreamEnd: true,
        });
      } catch {
        // Ignore stream-end errors during teardown.
      }
    }

    try {
      liveSessionRef.current?.close();
    } catch {
      // Ignore close errors during teardown.
    }
    liveSessionRef.current = null;

    processorRef.current?.disconnect();
    processorRef.current = null;

    analyserRef.current?.disconnect();
    analyserRef.current = null;

    if (micMeterFrameRef.current) {
      window.cancelAnimationFrame(micMeterFrameRef.current);
      micMeterFrameRef.current = null;
    }

    micStreamRef.current?.getTracks().forEach((track) => track.stop());
    micStreamRef.current = null;

    inputAudioContextRef.current?.close().catch(() => undefined);
    inputAudioContextRef.current = null;

    outputAudioContextRef.current?.close().catch(() => undefined);
    outputAudioContextRef.current = null;
    playbackCursorRef.current = 0;
    setMicLevel(0);
    setHasInputTranscript(false);
    audioEndedRef.current = false;
  }, []);

  useEffect(() => {
    if (!open || !session) {
      return;
    }

    let cancelled = false;
    setStatus("connecting");
    setLocalError(null);
    setTranscript({
      user: session.transcript.user,
      coach: session.transcript.coach,
    });
    setHasInputTranscript(session.transcript.user.length > 0);
    lastUserTranscriptRef.current = "";
    lastCoachTranscriptRef.current = "";
    audioEndedRef.current = false;

    const connectLive = async () => {
      try {
        const bootstrap = await fetchEnvelope<LiveBootstrapPayload>("/api/live/session", {
          method: "POST",
        });

        if (!bootstrap.ok || !bootstrap.data) {
          throw new Error(bootstrap.error ?? "Unable to start Gemini Live.");
        }

        const micStream = await navigator.mediaDevices.getUserMedia({
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
          },
          video: false,
        });

        if (cancelled) {
          micStream.getTracks().forEach((track) => track.stop());
          return;
        }

        const inputContext = new AudioContext();
        const outputContext = new AudioContext();
        await inputContext.resume();
        await outputContext.resume();

        const ai = new GoogleGenAI({
          apiKey: bootstrap.data.token,
          apiVersion: "v1alpha",
        });

        const source = inputContext.createMediaStreamSource(micStream);
        const processor = inputContext.createScriptProcessor(2048, 1, 1);
        const analyser = inputContext.createAnalyser();
        const silentGain = inputContext.createGain();
        silentGain.gain.value = 0;
        analyser.fftSize = 512;

        processor.onaudioprocess = (event) => {
          if (mutedRef.current || !liveSessionRef.current) {
            return;
          }

          audioEndedRef.current = false;

          const channel = event.inputBuffer.getChannelData(0);
          if (!channel.length) {
            return;
          }

          liveSessionRef.current.sendRealtimeInput({
            audio: {
              data: floatTo16BitPcmBase64(channel),
              mimeType: `audio/pcm;rate=${inputContext.sampleRate}`,
            },
          });
        };

        source.connect(analyser);
        source.connect(processor);
        processor.connect(silentGain);
        silentGain.connect(inputContext.destination);

        micStreamRef.current = micStream;
        inputAudioContextRef.current = inputContext;
        outputAudioContextRef.current = outputContext;
        processorRef.current = processor;
        analyserRef.current = analyser;

        const sampleBuffer = new Uint8Array(analyser.frequencyBinCount);
        const updateMicMeter = () => {
          if (cancelled || !analyserRef.current) {
            return;
          }

          analyserRef.current.getByteTimeDomainData(sampleBuffer);
          let sumSquares = 0;
          for (const value of sampleBuffer) {
            const normalized = (value - 128) / 128;
            sumSquares += normalized * normalized;
          }
          const rms = Math.sqrt(sumSquares / sampleBuffer.length);
          setMicLevel(Math.min(1, rms * 6));
          micMeterFrameRef.current = window.requestAnimationFrame(updateMicMeter);
        };
        micMeterFrameRef.current = window.requestAnimationFrame(updateMicMeter);

        const liveSession = await ai.live.connect({
          model: bootstrap.data.model,
          config: {
            responseModalities: [Modality.AUDIO],
            systemInstruction: bootstrap.data.systemInstruction,
            inputAudioTranscription: {},
            outputAudioTranscription: {},
          },
          callbacks: {
            onopen: () => {
              if (!cancelled) {
                setStatus("listening");
              }
            },
            onmessage: (message: LiveServerMessage) => {
              if (cancelled) {
                return;
              }

              if (message.setupComplete?.sessionId) {
                setStatus("listening");
              }

              const serverContent = message.serverContent;
              if (!serverContent) {
                return;
              }

              if (serverContent.interrupted) {
                playbackCursorRef.current = outputContext.currentTime;
                setStatus("listening");
              }

              if (serverContent.waitingForInput) {
                setStatus("listening");
              }

              if (serverContent.inputTranscription?.text) {
                setHasInputTranscript(true);
                appendTranscriptLine(
                  setTranscript,
                  "user",
                  serverContent.inputTranscription.text,
                  lastUserTranscriptRef,
                );
              }

              if (serverContent.outputTranscription?.text) {
                appendTranscriptLine(
                  setTranscript,
                  "coach",
                  serverContent.outputTranscription.text,
                  lastCoachTranscriptRef,
                );
                setStatus("speaking");
              }

              for (const part of serverContent.modelTurn?.parts ?? []) {
                const textPart = "text" in part ? part.text : undefined;
                const inlineData = "inlineData" in part ? part.inlineData : undefined;

                if (textPart && !serverContent.outputTranscription?.text) {
                  appendTranscriptLine(setTranscript, "coach", textPart, lastCoachTranscriptRef);
                }

                if (inlineData?.data) {
                  setStatus("speaking");
                  void playPcmChunk(outputContext, playbackCursorRef, inlineData.data, inlineData.mimeType);
                }
              }

              if (serverContent.turnComplete || serverContent.generationComplete) {
                setStatus("listening");
              }
            },
            onerror: (event) => {
              if (cancelled) {
                return;
              }

              const reason = event.message || event.error?.message || "Gemini Live connection failed.";
              setLocalError(reason);
              setStatus("error");
            },
            onclose: () => {
              if (!cancelled) {
                setStatus("ended");
              }
            },
          },
        });

        if (cancelled) {
          liveSession.close();
          return;
        }

        liveSessionRef.current = liveSession;
        if (bootstrap.data.initialPrompt) {
          liveSession.sendClientContent({
            turns: [
              {
                role: "user",
                parts: [{ text: bootstrap.data.initialPrompt }],
              },
            ],
            turnComplete: true,
          });
        }
      } catch (error) {
        if (cancelled) {
          return;
        }

        setLocalError(error instanceof Error ? error.message : "Gemini Live could not start.");
        setStatus("error");
        teardownLiveSession();
      }
    };

    void connectLive();

    return () => {
      cancelled = true;
      teardownLiveSession();
    };
  }, [open, session, teardownLiveSession]);

  useEffect(() => {
    if (!liveSessionRef.current || !open || !muted) {
      return;
    }

    if (audioEndedRef.current) {
      return;
    }

    try {
      liveSessionRef.current.sendRealtimeInput({
        audioStreamEnd: true,
      });
      audioEndedRef.current = true;
      setStatus("listening");
    } catch {
      // Ignore mute boundary errors and keep the session alive.
    }
  }, [muted, open]);

  const micStateLabel = muted
    ? "Muted"
    : micLevel > 0.08 && !hasInputTranscript
      ? "Mic is active, waiting for Gemini transcription"
      : micLevel > 0.08
        ? "Voice detected"
        : "Listening for audio";

  return (
    <AnimatePresence>
      {open && session ? (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 20 }}
          className="absolute inset-0 z-30 rounded-[36px] bg-[linear-gradient(180deg,rgba(48,73,68,0.96),rgba(25,39,37,0.98))] p-6 text-white"
        >
          <div className="flex items-center justify-between">
            <div>
              <div className="text-[11px] uppercase tracking-[0.28em] text-white/60">Live call</div>
              <div className="display-face mt-2 text-3xl">{session.title}</div>
            </div>
            <button type="button" onClick={onClose} className="rounded-full border border-white/15 p-3 text-white/80">
              <X className="h-4 w-4" />
            </button>
          </div>
          <div className="mt-6 rounded-[28px] border border-white/10 bg-white/6 p-5">
            <div className="flex items-center gap-3 text-sm text-white/70">
              <div className="rounded-full bg-white/10 p-3">
                <Mic className="h-5 w-5" />
              </div>
              Gemini Live{session.model ? ` · ${session.model}` : ""}
            </div>
            <div className="mt-4 flex items-center gap-2 text-xs uppercase tracking-[0.24em] text-white/55">
              <span className="rounded-full border border-white/10 px-3 py-1">{status}</span>
              <span className="rounded-full border border-white/10 px-3 py-1">{muted ? "mic muted" : "mic live"}</span>
            </div>
            <div className="mt-4 rounded-[18px] bg-white/8 px-4 py-3">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <div className="text-[10px] uppercase tracking-[0.24em] text-white/50">Mic input</div>
                  <div className="mt-1 text-sm text-white/85">{micStateLabel}</div>
                </div>
                <div className="flex min-w-[92px] items-end gap-1">
                  {[0.12, 0.24, 0.4, 0.58, 0.76].map((threshold, index) => (
                    <div
                      key={threshold}
                      className={cn(
                        "w-3 rounded-full transition-all",
                        micLevel > threshold ? "bg-white" : "bg-white/18",
                        index === 0 ? "h-3" : index === 1 ? "h-4" : index === 2 ? "h-5" : index === 3 ? "h-6" : "h-7",
                      )}
                    />
                  ))}
                </div>
              </div>
            </div>
            {localError ? (
              <div className="mt-4 rounded-[18px] border border-[rgba(255,255,255,0.12)] bg-[rgba(255,255,255,0.08)] px-4 py-3 text-sm leading-6 text-white/90">
                {localError}
              </div>
            ) : null}
            <div className="mt-5 grid gap-3">
              <div className="rounded-[18px] bg-white/8 px-4 py-3">
                <div className="text-[10px] uppercase tracking-[0.24em] text-white/50">Coach</div>
                <div className="mt-2 space-y-2 text-sm leading-6">
                  {(transcript.coach.length ? transcript.coach : ["Waiting for Gemini Live to answer."]).map((line, index) => (
                    <div key={`${line}-${index}`}>{line}</div>
                  ))}
                </div>
              </div>
              <div className="rounded-[18px] bg-white/8 px-4 py-3">
                <div className="text-[10px] uppercase tracking-[0.24em] text-white/50">You</div>
                <div className="mt-2 space-y-2 text-sm leading-6 text-white/85">
                  {(transcript.user.length ? transcript.user : ["Start talking when the connection opens."]).map((line, index) => (
                    <div key={`${line}-${index}`}>{line}</div>
                  ))}
                </div>
              </div>
            </div>
          </div>
          <div className="mt-5 grid grid-cols-4 gap-2">
            <button type="button" onClick={onDone} className="rounded-full bg-white px-4 py-3 text-sm font-semibold text-[var(--foreground)]">
              Done
            </button>
            <button type="button" onClick={onSnooze} className="rounded-full bg-white/10 px-4 py-3 text-sm font-semibold text-white">
              Snooze
            </button>
            <button
              type="button"
              onClick={() => setMuted((current) => !current)}
              className="rounded-full bg-white/10 px-4 py-3 text-sm font-semibold text-white"
            >
              {muted ? "Unmute" : "Mute"}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="rounded-full bg-white/10 px-4 py-3 text-sm font-semibold text-white"
            >
              End
            </button>
          </div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}

function CameraOverlay({
  mode,
  open,
  onClose,
  onCapture,
}: {
  mode: CameraMode;
  open: boolean;
  onClose: () => void;
  onCapture: (dataUrl: string) => void;
}) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      return;
    }

    let cancelled = false;

    const startCamera = async () => {
      setError(null);
      for (const constraints of buildCameraConstraints(mode ?? "meal")) {
        try {
          const stream = await navigator.mediaDevices.getUserMedia(constraints);

          if (cancelled) {
            stream.getTracks().forEach((track) => track.stop());
            return;
          }

          streamRef.current = stream;

          if (videoRef.current) {
            videoRef.current.srcObject = stream;
            await videoRef.current.play();
          }

          return;
        } catch {
          // Try the next camera profile before failing.
        }
      }

      setError("Camera access failed. You can use the upload fallback instead.");
    };

    void startCamera();

    return () => {
      cancelled = true;
      streamRef.current?.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    };
  }, [mode, open]);

  function captureFrame() {
    if (!videoRef.current) {
      return;
    }

    const canvas = document.createElement("canvas");
    canvas.width = videoRef.current.videoWidth || 720;
    canvas.height = videoRef.current.videoHeight || 960;
    const context = canvas.getContext("2d");

    if (!context) {
      return;
    }

    context.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
    const image = canvas.toDataURL("image/jpeg", 0.92);
    onCapture(image);
    onClose();
  }

  async function handleUpload(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") {
        onCapture(reader.result);
        onClose();
      }
    };
    reader.readAsDataURL(file);
  }

  return (
    <AnimatePresence>
      {open ? (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="absolute inset-0 z-20 rounded-[36px] bg-[rgba(20,28,27,0.94)] p-5 text-white"
        >
          <div className="flex items-center justify-between">
            <div>
              <div className="text-[11px] uppercase tracking-[0.28em] text-white/60">{mode === "meal" ? "Meal camera" : "Workout camera"}</div>
              <div className="mt-2 text-lg font-semibold">{mode === "meal" ? "Show your food" : "Camera preview"}</div>
            </div>
            <button type="button" onClick={onClose} className="rounded-full border border-white/15 p-3 text-white/80">
              <X className="h-4 w-4" />
            </button>
          </div>
          <div className="mt-5 overflow-hidden rounded-[28px] border border-white/10 bg-black">
            <video ref={videoRef} playsInline autoPlay muted className="h-[58vh] w-full object-cover" />
          </div>
          <div className="mt-4 flex gap-3">
            <button
              type="button"
              onClick={captureFrame}
              className="flex-1 rounded-full bg-white px-5 py-4 text-sm font-semibold text-[var(--foreground)]"
            >
              Capture
            </button>
            <label className="rounded-full bg-white/10 px-5 py-4 text-sm font-semibold text-white">
              Upload
              <input type="file" accept="image/*" className="hidden" onChange={handleUpload} />
            </label>
          </div>
          {error ? <div className="mt-3 text-sm text-white/70">{error}</div> : null}
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}

function SquatTrackerOverlay({
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
  const streamRef = useRef<MediaStream | null>(null);
  const frameRef = useRef<number | null>(null);
  const detectorRef = useRef<{
    detectForVideo: (
      video: HTMLVideoElement,
      timestampMs: number,
    ) => { landmarks?: Array<Array<{ x: number; y: number }>> };
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reps, setReps] = useState(0);
  const [cue, setCue] = useState("Stand tall to begin.");
  const phaseRef = useRef<"up" | "down">("up");

  useEffect(() => {
    if (!open) {
      return;
    }

    let cancelled = false;
    const originalConsoleError = console.error;
    console.error = (...args: unknown[]) => {
      const line = args.map((value) => String(value)).join(" ");
      if (line.includes("Created TensorFlow Lite XNNPACK delegate for CPU")) {
        return;
      }
      originalConsoleError(...args);
    };

    const start = async () => {
      setLoading(true);
      setError(null);

      try {
        const visionBundlePath = "/vendor/mediapipe/vision_bundle.mjs";
        const { FilesetResolver, PoseLandmarker } = (await import(
          /* webpackIgnore: true */ visionBundlePath
        )) as {
          FilesetResolver: {
            forVisionTasks(basePath: string): Promise<unknown>;
          };
          PoseLandmarker: {
            createFromOptions(
              vision: unknown,
              options: unknown,
            ): Promise<{
              detectForVideo(
                video: HTMLVideoElement,
                timestampMs: number,
              ): { landmarks?: Array<Array<{ x: number; y: number }>> };
            }>;
          };
        };

        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: "user",
            width: { ideal: 960 },
            height: { ideal: 720 },
          },
          audio: false,
        });

        if (cancelled) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }

        streamRef.current = stream;

        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
        }

        const vision = await FilesetResolver.forVisionTasks(
          "/vendor/mediapipe",
        );

        detectorRef.current = await PoseLandmarker.createFromOptions(vision, {
          baseOptions: {
            modelAssetPath: "/models/pose_landmarker_lite.task",
          },
          runningMode: "VIDEO",
          numPoses: 1,
        });

        setLoading(false);

        const loop = () => {
          if (!videoRef.current || !canvasRef.current || !detectorRef.current) {
            frameRef.current = window.requestAnimationFrame(loop);
            return;
          }

          const video = videoRef.current;
          const canvas = canvasRef.current;
          const ctx = canvas.getContext("2d");

          if (!ctx || video.readyState < 2) {
            frameRef.current = window.requestAnimationFrame(loop);
            return;
          }

          canvas.width = video.videoWidth;
          canvas.height = video.videoHeight;
          const result = detectorRef.current.detectForVideo(video, performance.now());
          const landmarks = result.landmarks?.[0];

          ctx.clearRect(0, 0, canvas.width, canvas.height);

          if (landmarks?.length) {
            drawPoseOverlay(ctx, canvas.width, canvas.height, landmarks);
            const angle = averageKneeAngle(landmarks);

            if (angle < 100 && phaseRef.current === "up") {
              phaseRef.current = "down";
              setCue("Drive back up.");
            }

            if (angle > 155 && phaseRef.current === "down") {
              phaseRef.current = "up";
              setReps((current) => current + 1);
              setCue("Good rep. Go again.");
            }

            if (angle >= 100 && angle <= 155) {
              setCue("Sit lower, then stand tall.");
            }
          }

          frameRef.current = window.requestAnimationFrame(loop);
        };

        frameRef.current = window.requestAnimationFrame(loop);
      } catch (error) {
        setLoading(false);
        setError(error instanceof Error ? error.message : "Workout tracking could not start.");
      }
    };

    void start();

    return () => {
      cancelled = true;
      console.error = originalConsoleError;
      if (frameRef.current) {
        window.cancelAnimationFrame(frameRef.current);
      }
      streamRef.current?.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
      detectorRef.current = null;
    };
  }, [open]);

  return (
    <AnimatePresence>
      {open ? (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="absolute inset-0 z-20 rounded-[36px] bg-[rgba(20,28,27,0.96)] p-5 text-white"
        >
          <div className="flex items-center justify-between">
            <div>
              <div className="text-[11px] uppercase tracking-[0.28em] text-white/60">Squat tracker</div>
              <div className="mt-2 text-lg font-semibold">Body points + rep count</div>
            </div>
            <button type="button" onClick={onClose} className="rounded-full border border-white/15 p-3 text-white/80">
              <X className="h-4 w-4" />
            </button>
          </div>
          <div className="mt-5 relative overflow-hidden rounded-[28px] border border-white/10 bg-black">
            <video ref={videoRef} playsInline autoPlay muted className="h-[54vh] w-full object-cover" />
            <canvas ref={canvasRef} className="absolute inset-0 h-full w-full" />
            {loading ? (
              <div className="absolute inset-0 flex items-center justify-center bg-black/40 text-sm text-white/70">
                <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />
                Starting tracker
              </div>
            ) : null}
          </div>
          <div className="mt-4 grid grid-cols-2 gap-3">
            <div className="rounded-[22px] bg-white/8 p-4">
              <div className="text-[10px] uppercase tracking-[0.24em] text-white/50">Reps</div>
              <div className="display-face mt-2 text-4xl">{reps}</div>
            </div>
            <div className="rounded-[22px] bg-white/8 p-4 text-sm leading-6 text-white/80">{error ?? cue}</div>
          </div>
          <button
            type="button"
            onClick={() => onSave(reps)}
            disabled={reps < 1}
            className="mt-4 flex w-full items-center justify-center gap-3 rounded-full bg-white px-5 py-4 text-sm font-semibold text-[var(--foreground)] disabled:opacity-40"
          >
            <Check className="h-4 w-4" />
            Save squat session
          </button>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}

const poseConnections: Array<[number, number]> = [
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
  [27, 31],
  [28, 32],
  [27, 29],
  [28, 30],
];

function drawPoseOverlay(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  landmarks: Array<{ x: number; y: number }>,
) {
  ctx.strokeStyle = "rgba(149, 84, 255, 0.95)";
  ctx.lineWidth = 3;

  for (const [from, to] of poseConnections) {
    const start = landmarks[from];
    const end = landmarks[to];

    if (!start || !end) {
      continue;
    }

    ctx.beginPath();
    ctx.moveTo(start.x * width, start.y * height);
    ctx.lineTo(end.x * width, end.y * height);
    ctx.stroke();
  }

  ctx.fillStyle = "rgba(255, 219, 69, 0.98)";
  ctx.font = "600 12px system-ui, sans-serif";

  for (const [index, point] of landmarks.entries()) {
    const x = point.x * width;
    const y = point.y * height;
    ctx.beginPath();
    ctx.arc(x, y, 5, 0, Math.PI * 2);
    ctx.fill();
    if ([0, 11, 12, 13, 14, 15, 16, 23, 24, 25, 26, 27, 28, 31, 32].includes(index)) {
      ctx.fillStyle = "rgba(255,255,255,0.96)";
      ctx.fillText(String(index), x + 8, y - 8);
      ctx.fillStyle = "rgba(255, 219, 69, 0.98)";
    }
  }
}

function averageKneeAngle(landmarks: Array<{ x: number; y: number }>) {
  const left = jointAngle(landmarks[23], landmarks[25], landmarks[27]);
  const right = jointAngle(landmarks[24], landmarks[26], landmarks[28]);
  return (left + right) / 2;
}

function jointAngle(
  a?: { x: number; y: number },
  b?: { x: number; y: number },
  c?: { x: number; y: number },
) {
  if (!a || !b || !c) {
    return 180;
  }

  const ab = { x: a.x - b.x, y: a.y - b.y };
  const cb = { x: c.x - b.x, y: c.y - b.y };
  const dot = ab.x * cb.x + ab.y * cb.y;
  const magAB = Math.hypot(ab.x, ab.y);
  const magCB = Math.hypot(cb.x, cb.y);
  const cosine = dot / Math.max(0.00001, magAB * magCB);
  return (Math.acos(Math.min(1, Math.max(-1, cosine))) * 180) / Math.PI;
}

export function SwasthyaApp() {
  const [state, setState] = useState<AppState | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [input, setInput] = useState("");
  const [clarification, setClarification] = useState("");
  const [cameraMode, setCameraMode] = useState<CameraMode>(null);
  const [liveOpen, setLiveOpen] = useState(false);
  const [trackerOpen, setTrackerOpen] = useState(false);
  const [form, setForm] = useState<OnboardingInput>({
    displayName: "Bhavya",
    goal: goalOptions[0],
    workoutSplit: splitOptions[0],
    trainingDays: 3,
    proteinFocus: "Keep it simple",
    recoveryTime: "21:00",
    tone: "balanced",
  });
  const scrollRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const load = async () => {
      const response = await fetchEnvelope<AppState>("/api/bootstrap");
      if (!response.ok || !response.data) {
        setError(response.error);
        return;
      }

      setState(response.data);
    };

    void load();
  }, []);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [state?.messages, state?.currentMealDraft]);

  const recoveryLabel = useMemo(() => {
    if (!state?.recoverySession) {
      return "No recovery";
    }

    const minutes = minutesUntil(state.recoverySession.scheduledFor);
    if (state.recoverySession.status === "live") {
      return "Live now";
    }

    return minutes > 0 ? `In ${minutes} min` : "Ready";
  }, [state?.recoverySession]);

  async function mutateState<T>(url: string, body?: unknown) {
    setBusy(url);
    setError(null);

    const response = await fetchEnvelope<T>(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: body ? JSON.stringify(body) : undefined,
    });

    setBusy(null);

    if (!response.ok || !response.data) {
      setError(response.error);
      return null;
    }

    return response.data;
  }

  async function loadState(url: string, body?: unknown) {
    const data = await mutateState<AppState>(url, body);
    if (data) {
      startTransition(() => {
        setState(data);
        if (data.currentMealDraft) {
          setClarification(data.currentMealDraft.quickAnswers[0] ?? "");
        }
      });
    }

    return data;
  }

  async function startLiveSession() {
    const data = await loadState("/api/recovery/action", { action: "live" });
    if (data?.liveSession) {
      setLiveOpen(true);
    }
  }

  async function submitCoachMessage() {
    if (!input.trim()) {
      return;
    }

    const data = await mutateState<CoachEnvelope>("/api/coach/message", { message: input });
    if (!data) {
      return;
    }

    startTransition(() => {
      setState(data.state);
      setInput("");
      if (data.action === "open_meal_camera") {
        setCameraMode("meal");
      }
      if (data.action === "open_workout_tracker") {
        setTrackerOpen(true);
      }
      if (data.action === "open_live_session") {
        setLiveOpen(true);
      }
    });
  }

  if (!state) {
    return (
      <main className="flex min-h-screen items-center justify-center px-6">
        <div className="surface-panel-strong flex items-center gap-3 rounded-full px-5 py-3 text-sm text-[var(--muted)]">
          <LoaderCircle className="h-4 w-4 animate-spin" />
          Loading Swasthya
        </div>
      </main>
    );
  }

  const workout = state.workoutPlan?.sessions[0] ?? null;

  return (
    <main className="relative min-h-screen overflow-hidden px-4 py-6 md:px-6">
      <div className="mx-auto flex max-w-6xl justify-center">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="ambient-shell relative w-full max-w-[430px] rounded-[36px] border border-white/60 p-4 shadow-[0_40px_90px_rgba(91,102,97,0.18)]"
        >
          <div className="mb-4 flex items-center justify-between px-1 pt-1">
            <div>
              <div className="text-[11px] uppercase tracking-[0.28em] text-[var(--muted)]">Swasthya</div>
              <div className="display-face text-2xl">Coach that listens.</div>
            </div>
            <button
              type="button"
              onClick={() => void loadState("/api/reset")}
              className="rounded-full border border-[var(--line)] bg-white/70 p-3 text-[var(--muted)] transition hover:text-[var(--foreground)]"
            >
              <RefreshCcw className="h-4 w-4" />
            </button>
          </div>

          {!state.onboardingCompleted ? (
            <SetupScreen
              form={form}
              setForm={setForm}
              busy={busy === "/api/onboarding"}
              onSubmit={() => void loadState("/api/onboarding", form)}
            />
          ) : (
            <>
              <div className="grid grid-cols-3 gap-2">
                <StatusPill label="Protein" value={`${state.summary.proteinEstimate}g`} />
                <StatusPill label="Workout" value={workout?.status ?? "Planned"} />
                <StatusPill label="Recovery" value={recoveryLabel} />
              </div>

              <Surface className="mt-4 flex items-center justify-between gap-4 rounded-[28px] bg-[linear-gradient(145deg,rgba(255,250,244,0.92),rgba(219,232,222,0.64))] py-4">
                <div className="min-w-0">
                  <div className="text-[11px] uppercase tracking-[0.28em] text-[var(--muted)]">Now</div>
                  <div className="mt-1 truncate text-base font-semibold text-[var(--foreground)]">
                    {workout?.title ?? "Ready to coach"}
                  </div>
                  <div className="mt-1 text-sm text-[var(--muted)]">
                    {state.summary.coachNote}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => void startLiveSession()}
                  className="rounded-full bg-[var(--foreground)] p-3 text-white"
                >
                  <Mic className="h-5 w-5" />
                </button>
              </Surface>

              <div ref={scrollRef} className="mt-4 max-h-[49vh] space-y-3 overflow-y-auto rounded-[28px] bg-white/45 p-1 pb-2">
                {workout ? (
                  <Surface className="space-y-3 bg-white/84">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="text-[11px] uppercase tracking-[0.24em] text-[var(--muted)]">Workout</div>
                        <div className="mt-1 text-lg font-semibold">{workout.title}</div>
                      </div>
                      <div className="rounded-full bg-[rgba(69,100,94,0.1)] px-3 py-2 text-xs font-semibold text-[var(--eucalyptus)]">
                        {workout.durationMin} min
                      </div>
                    </div>
                    <div className="space-y-2 text-sm text-[var(--muted)]">
                      {workout.exercises.map((exercise) => (
                        <div key={exercise.name} className="flex items-center justify-between rounded-[18px] bg-[rgba(245,241,235,0.9)] px-4 py-3">
                          <span>{exercise.name}</span>
                          <span>{exercise.sets}</span>
                        </div>
                      ))}
                    </div>
                    {workout.adaptationNote ? (
                      <div className="rounded-[18px] bg-[rgba(139,162,143,0.14)] px-4 py-3 text-sm leading-6">
                        {workout.adaptationNote}
                      </div>
                    ) : null}
                    {typeof workout.trackedReps === "number" ? (
                      <div className="rounded-[18px] bg-[rgba(197,141,78,0.14)] px-4 py-3 text-sm">
                        Logged squat reps: {workout.trackedReps}
                      </div>
                    ) : null}
                  </Surface>
                ) : null}

                {state.messages.map((message) => (
                  <MessageBubble key={message.id} message={message} />
                ))}

                <MealDraftCard
                  state={state}
                  clarification={clarification}
                  setClarification={setClarification}
                  onLog={() => void loadState("/api/meal/log", { clarification })}
                  busy={busy === "/api/meal/log"}
                />
              </div>

              {error ? (
                <div className="mt-3 rounded-[20px] border border-[rgba(197,141,78,0.2)] bg-[rgba(197,141,78,0.12)] px-4 py-3 text-sm text-[var(--foreground)]">
                  {error}
                </div>
              ) : null}

              <div className="mt-4 space-y-3">
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setCameraMode("meal")}
                    className="rounded-full bg-[var(--foreground)] px-4 py-3 text-sm font-semibold text-white"
                  >
                    <span className="inline-flex items-center gap-2">
                      <Camera className="h-4 w-4" />
                      Meal
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setTrackerOpen(true)}
                    className="rounded-full bg-white/80 px-4 py-3 text-sm font-semibold text-[var(--foreground)]"
                  >
                    <span className="inline-flex items-center gap-2">
                      <Dumbbell className="h-4 w-4" />
                      Squats
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={() => void startLiveSession()}
                    className="rounded-full bg-white/80 px-4 py-3 text-sm font-semibold text-[var(--foreground)]"
                  >
                    <span className="inline-flex items-center gap-2">
                      <TimerReset className="h-4 w-4" />
                      Live
                    </span>
                  </button>
                </div>

                <div className="surface-panel-strong space-y-2 rounded-[28px] px-3 py-3">
                  <div>
                    <div className="px-2 text-[10px] uppercase tracking-[0.28em] text-[var(--muted)]">Chat</div>
                  </div>
                  <div className="flex items-center gap-3">
                    <input
                      value={input}
                      onChange={(event) => setInput(event.target.value)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter") {
                          event.preventDefault();
                          void submitCoachMessage();
                        }
                      }}
                      placeholder="I ate 4 apples"
                      className="min-w-0 flex-1 bg-transparent px-2 outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => void submitCoachMessage()}
                      disabled={!input.trim() || busy === "/api/coach/message"}
                      className="rounded-full bg-[var(--foreground)] p-3 text-white disabled:opacity-40"
                    >
                      {busy === "/api/coach/message" ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                    </button>
                  </div>
                </div>
              </div>
            </>
          )}

          <CameraOverlay
            mode={cameraMode}
            open={cameraMode === "meal"}
            onClose={() => setCameraMode(null)}
            onCapture={(image) => void loadState("/api/meal/analyze", { imageDataUrl: image })}
          />

          <SquatTrackerOverlay
            open={trackerOpen}
            onClose={() => setTrackerOpen(false)}
            onSave={(reps) => {
              void loadState("/api/workout/tracker", { reps });
              setTrackerOpen(false);
            }}
          />

          <LiveCallOverlay
            session={state.liveSession}
            open={liveOpen}
            onClose={() => setLiveOpen(false)}
            onDone={() => {
              void loadState("/api/recovery/action", { action: "done" });
              setLiveOpen(false);
            }}
            onSnooze={() => {
              void loadState("/api/recovery/action", { action: "snooze" });
              setLiveOpen(false);
            }}
          />
        </motion.div>
      </div>
    </main>
  );
}
