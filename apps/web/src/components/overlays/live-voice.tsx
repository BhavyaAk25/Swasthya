"use client";

import { GoogleGenAI, Modality, type LiveServerMessage, type Session } from "@google/genai";
import { AnimatePresence, motion } from "framer-motion";
import { Mic, MicOff, RotateCcw } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

import { Button, IconButton, fade } from "@/components/ui";
import { Illustration } from "@/components/visuals";
import type { Goal } from "@/lib/types";
import { cn } from "@/lib/utils";

type Phase = "connecting" | "listening" | "speaking" | "ended" | "error";
type Line = { id: number; text: string };

const openingTurn = (name: string) => `My name is ${name.slice(0, 40)}. Please begin a short, calm recovery session.`;
const CONNECT_TIMEOUT_MS = 15000;
const MAX_LINE_CHARS = 220;

/** Collects mic audio on the audio thread and posts ~100ms Float32 chunks to the main thread. */
const WORKLET_SOURCE = `
class SwasthyaPcmTap extends AudioWorkletProcessor {
  constructor(options) {
    super();
    const size = (options && options.processorOptions && options.processorOptions.size) || 2048;
    this.size = size;
    this.buf = new Float32Array(size);
    this.n = 0;
  }
  process(inputs) {
    const ch = inputs[0] && inputs[0][0];
    if (ch) {
      for (let i = 0; i < ch.length; i++) {
        this.buf[this.n++] = ch[i];
        if (this.n === this.size) {
          this.port.postMessage(this.buf, [this.buf.buffer]);
          this.buf = new Float32Array(this.size);
          this.n = 0;
        }
      }
    }
    return true;
  }
}
registerProcessor("swasthya-pcm-tap", SwasthyaPcmTap);
`;

// ---------- audio helpers ----------

function pcm16Base64(input: Float32Array) {
  const bytes = new Uint8Array(input.length * 2);
  const view = new DataView(bytes.buffer);
  for (let i = 0; i < input.length; i += 1) {
    const s = Math.max(-1, Math.min(1, input[i] ?? 0));
    view.setInt16(i * 2, s < 0 ? s * 0x8000 : s * 0x7fff, true);
  }
  let binary = "";
  const step = 0x2000;
  for (let i = 0; i < bytes.length; i += step) {
    binary += String.fromCharCode(...bytes.subarray(i, i + step));
  }
  return btoa(binary);
}

function decodePcm16(base64: string) {
  const binary = atob(base64);
  const count = Math.floor(binary.length / 2);
  const out = new Float32Array(count);
  for (let i = 0; i < count; i += 1) {
    let v = binary.charCodeAt(i * 2) | (binary.charCodeAt(i * 2 + 1) << 8);
    if (v >= 0x8000) v -= 0x10000;
    out[i] = v / 0x8000;
  }
  return out;
}

function mimeRate(mimeType?: string) {
  const rate = Number(mimeType?.match(/rate=(\d+)/i)?.[1]);
  return Number.isFinite(rate) && rate > 0 ? rate : 24000;
}

function rmsLevel(analyser: AnalyserNode | null, buffer: Float32Array<ArrayBuffer> | null) {
  if (!analyser || !buffer) return 0;
  analyser.getFloatTimeDomainData(buffer);
  let sum = 0;
  for (let i = 0; i < buffer.length; i += 1) sum += buffer[i] * buffer[i];
  return Math.min(1, Math.sqrt(sum / buffer.length) * 4);
}

/** Transcription arrives as fragments; join them and keep whitespace tidy. */
function joinFragment(current: string, fragment: string) {
  return (current + fragment).replace(/\s+/g, " ").replace(/\s+([,.!?;:])/g, "$1").trimStart();
}

/** Show only the tail of a very long turn so the newest words stay visible. */
function tail(text: string) {
  const t = text.trim();
  if (t.length <= MAX_LINE_CHARS) return t;
  const cut = t.slice(-MAX_LINE_CHARS);
  const space = cut.indexOf(" ");
  return `…${space > 0 ? cut.slice(space + 1) : cut}`;
}

function micErrorMessage(error: unknown) {
  const name = error instanceof DOMException ? error.name : "";
  if (name === "NotAllowedError" || name === "SecurityError") {
    return "Microphone access is blocked. Allow it in your browser to talk with your coach.";
  }
  if (name === "NotFoundError" || name === "OverconstrainedError") return "No microphone was found.";
  if (name === "NotReadableError") return "Your microphone is busy in another app.";
  return "The microphone could not start.";
}

class LiveVoiceError extends Error {}

// ---------- component ----------

export function LiveVoice({ name, goal, onEnd }: { name: string; goal: Goal; onEnd: (minutes: number) => void }) {
  const [phase, setPhase] = useState<Phase>("connecting");
  const [error, setError] = useState<string | null>(null);
  const [muted, setMuted] = useState(false);
  const [coach, setCoach] = useState<Line>({ id: 0, text: "" });
  const [user, setUser] = useState<Line>({ id: 0, text: "" });
  const [attempt, setAttempt] = useState(0);
  const [everConnected, setEverConnected] = useState(false);

  const sessionRef = useRef<Session | null>(null);
  const micStreamRef = useRef<MediaStream | null>(null);
  const mutedRef = useRef(false);
  const streamEndedRef = useRef(false);
  const connectedAtRef = useRef<number | null>(null);
  const orbRef = useRef<HTMLDivElement | null>(null);
  const haloRef = useRef<HTMLDivElement | null>(null);

  // Session lifecycle: one full rig per attempt, torn down completely on cleanup/unmount.
  useEffect(() => {
    let alive = true; // false once React cleans this rig up
    let stopped = false; // true once this rig failed or ended on its own
    let closingOnPurpose = false;
    const active = () => alive && !stopped;
    const abort = new AbortController();

    let inputCtx: AudioContext | null = null;
    let outputCtx: AudioContext | null = null;
    let micStream: MediaStream | null = null;
    let micSource: MediaStreamAudioSourceNode | null = null;
    let tapNode: AudioWorkletNode | ScriptProcessorNode | null = null;
    let sink: GainNode | null = null;
    let micAnalyser: AnalyserNode | null = null;
    let outAnalyser: AnalyserNode | null = null;
    let micBuf: Float32Array<ArrayBuffer> | null = null;
    let outBuf: Float32Array<ArrayBuffer> | null = null;
    let session: Session | null = null;
    let raf = 0;
    let timeout = 0;
    let cursor = 0;
    const sources = new Set<AudioBufferSourceNode>();

    let lineSeq = 0;
    let coachOpen = false;
    let userOpen = false;

    streamEndedRef.current = false;

    const fail = (message: string) => {
      if (!active()) return;
      stopped = true;
      setError(message);
      setPhase("error");
      teardown();
    };

    const stopPlayback = () => {
      for (const s of sources) {
        try {
          s.onended = null;
          s.stop();
        } catch {
          // already finished
        }
      }
      sources.clear();
      cursor = outputCtx?.currentTime ?? 0;
    };

    const sendChunk = (samples: Float32Array) => {
      const s = sessionRef.current;
      if (!s || !inputCtx || mutedRef.current || !samples.length) return;
      try {
        s.sendRealtimeInput({ audio: { data: pcm16Base64(samples), mimeType: `audio/pcm;rate=${inputCtx.sampleRate}` } });
        streamEndedRef.current = false;
      } catch {
        // socket closing; onclose handles state
      }
    };

    const playChunk = (base64: string, mimeType?: string) => {
      if (!outputCtx || !outAnalyser) return;
      const samples = decodePcm16(base64);
      if (!samples.length) return;
      const buffer = outputCtx.createBuffer(1, samples.length, mimeRate(mimeType));
      buffer.copyToChannel(samples, 0);
      const src = outputCtx.createBufferSource();
      src.buffer = buffer;
      src.connect(outAnalyser);
      sources.add(src);
      src.onended = () => {
        sources.delete(src);
        if (active() && sources.size === 0) setPhase((p) => (p === "speaking" ? "listening" : p));
      };
      const now = outputCtx.currentTime;
      const startAt = cursor < now ? now + 0.03 : cursor;
      src.start(startAt);
      cursor = startAt + buffer.duration;
    };

    const onCoachFragment = (fragment: string) => {
      userOpen = false;
      if (!coachOpen) {
        coachOpen = true;
        lineSeq += 1;
        const id = lineSeq;
        setCoach({ id, text: joinFragment("", fragment) });
      } else {
        setCoach((c) => ({ id: c.id, text: joinFragment(c.text, fragment) }));
      }
    };

    const onUserFragment = (fragment: string, finished?: boolean) => {
      if (!userOpen) {
        userOpen = true;
        lineSeq += 1;
        const id = lineSeq;
        setUser({ id, text: joinFragment("", fragment) });
      } else {
        setUser((u) => ({ id: u.id, text: joinFragment(u.text, fragment) }));
      }
      if (finished) userOpen = false;
    };

    const onMessage = (message: LiveServerMessage) => {
      if (!active()) return;
      const content = message.serverContent;
      if (!content) return;

      if (content.interrupted) {
        stopPlayback();
        coachOpen = false;
        setPhase((p) => (p === "speaking" ? "listening" : p));
      }

      const heard = content.inputTranscription?.text;
      if (heard) onUserFragment(heard, content.inputTranscription?.finished);

      const said = content.outputTranscription?.text;
      if (said) onCoachFragment(said);

      for (const part of content.modelTurn?.parts ?? []) {
        if (part.inlineData?.data && part.inlineData.mimeType?.startsWith("audio/")) {
          playChunk(part.inlineData.data, part.inlineData.mimeType);
          setPhase((p) => (p === "listening" || p === "connecting" ? "speaking" : p));
        }
      }

      if (content.turnComplete) {
        coachOpen = false;
        userOpen = false;
        if (sources.size === 0) setPhase((p) => (p === "speaking" ? "listening" : p));
      }
    };

    const buildMicTap = async (ctx: AudioContext, source: MediaStreamAudioSourceNode) => {
      const size = Math.max(1024, Math.round(ctx.sampleRate * 0.1));
      sink = ctx.createGain();
      sink.gain.value = 0;
      sink.connect(ctx.destination);

      if (ctx.audioWorklet && typeof AudioWorkletNode !== "undefined") {
        const url = URL.createObjectURL(new Blob([WORKLET_SOURCE], { type: "application/javascript" }));
        try {
          await ctx.audioWorklet.addModule(url);
          const node = new AudioWorkletNode(ctx, "swasthya-pcm-tap", {
            numberOfInputs: 1,
            numberOfOutputs: 1,
            outputChannelCount: [1],
            processorOptions: { size },
          });
          node.port.onmessage = (e: MessageEvent<Float32Array>) => sendChunk(e.data);
          source.connect(node);
          node.connect(sink);
          return node;
        } catch {
          // fall through to ScriptProcessor
        } finally {
          URL.revokeObjectURL(url);
        }
      }

      const node = ctx.createScriptProcessor(2048, 1, 1);
      node.onaudioprocess = (e) => sendChunk(e.inputBuffer.getChannelData(0).slice());
      source.connect(node);
      node.connect(sink);
      return node;
    };

    function teardown() {
      window.clearTimeout(timeout);
      cancelAnimationFrame(raf);
      raf = 0;

      if (session) {
        closingOnPurpose = true;
        try {
          session.close();
        } catch {
          // ignore
        }
      }
      session = null;
      sessionRef.current = null;

      stopPlayback();

      if (tapNode) {
        if ("port" in tapNode) tapNode.port.onmessage = null;
        else tapNode.onaudioprocess = null;
        tapNode.disconnect();
      }
      tapNode = null;
      micSource?.disconnect();
      micSource = null;
      sink?.disconnect();
      sink = null;
      micAnalyser?.disconnect();
      micAnalyser = null;
      outAnalyser?.disconnect();
      outAnalyser = null;

      micStream?.getTracks().forEach((t) => t.stop());
      micStream = null;
      micStreamRef.current = null;

      inputCtx?.close().catch(() => undefined);
      inputCtx = null;
      outputCtx?.close().catch(() => undefined);
      outputCtx = null;
    }

    // Visuals: one rAF loop, DOM writes only (no React state per frame).
    const reduceMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
    let outLevel = 0;
    let micLevel = 0;
    const tick = (t: number) => {
      const out = rmsLevel(outAnalyser, outBuf);
      const mic = mutedRef.current ? 0 : rmsLevel(micAnalyser, micBuf);
      outLevel += (out - outLevel) * (out > outLevel ? 0.3 : 0.06);
      micLevel += (mic - micLevel) * (mic > micLevel ? 0.25 : 0.05);

      // Listening: slow 8s breath. Speaking: follow the coach's voice. Blend so there is never a jump.
      const w = Math.min(1, outLevel * 3);
      const breath = reduceMotion ? 0.5 : (Math.sin((t / 8000) * Math.PI * 2 - Math.PI / 2) + 1) / 2;
      const scale = (0.86 + 0.12 * breath) * (1 - w) + (0.94 + outLevel * 0.16) * w;
      if (orbRef.current) orbRef.current.style.transform = `scale(${scale.toFixed(4)})`;
      if (haloRef.current) {
        haloRef.current.style.transform = `scale(${(1 + micLevel * 0.22).toFixed(4)})`;
        haloRef.current.style.opacity = (0.35 + micLevel * 0.65).toFixed(3);
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);

    const start = async () => {
      // Output context first so it is created as close to the user's tap as possible.
      outputCtx = new AudioContext();
      outAnalyser = outputCtx.createAnalyser();
      outAnalyser.fftSize = 1024;
      outAnalyser.connect(outputCtx.destination);
      outBuf = new Float32Array(outAnalyser.fftSize);
      void outputCtx.resume().catch(() => undefined);

      // 1. Microphone (before the single-use token so a denied prompt doesn't waste one).
      if (!navigator.mediaDevices?.getUserMedia) {
        throw new LiveVoiceError("Live voice needs a secure connection and a browser with microphone support.");
      }
      let stream: MediaStream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true, channelCount: 1 },
          video: false,
        });
      } catch (e) {
        throw new LiveVoiceError(micErrorMessage(e));
      }
      if (!active()) {
        // Torn down while the permission prompt was open.
        stream.getTracks().forEach((t) => t.stop());
        return;
      }
      micStream = stream;
      micStreamRef.current = micStream;
      micStream.getAudioTracks().forEach((t) => (t.enabled = !mutedRef.current));

      // Prefer 16 kHz capture (what Live expects); some browsers refuse cross-rate mic sources.
      try {
        inputCtx = new AudioContext({ sampleRate: 16000 });
        micSource = inputCtx.createMediaStreamSource(micStream);
      } catch {
        inputCtx?.close().catch(() => undefined);
        inputCtx = new AudioContext();
        micSource = inputCtx.createMediaStreamSource(micStream);
      }
      void inputCtx.resume().catch(() => undefined);
      micAnalyser = inputCtx.createAnalyser();
      micAnalyser.fftSize = 1024;
      micBuf = new Float32Array(micAnalyser.fftSize);
      micSource.connect(micAnalyser);
      tapNode = await buildMicTap(inputCtx, micSource);
      if (!active()) return;

      // 2. Ephemeral token.
      const res = await fetch("/api/live", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ goal }),
        signal: abort.signal,
      });
      const data = (await res.json().catch(() => ({}))) as { token?: string; model?: string; offline?: boolean; error?: string };
      if (!active()) return;
      if (!res.ok || !data.token || !data.model) {
        throw new LiveVoiceError(
          data.offline ? "Live voice isn't available right now." : data.error || "Live voice could not start.",
        );
      }

      // 3. Connect. The SDK waits for the socket to open, so guard against a hang.
      timeout = window.setTimeout(() => fail("The connection is taking too long."), CONNECT_TIMEOUT_MS);
      const ai = new GoogleGenAI({ apiKey: data.token, apiVersion: "v1alpha" });
      const live = await ai.live.connect({
        model: data.model,
        config: { responseModalities: [Modality.AUDIO], inputAudioTranscription: {}, outputAudioTranscription: {} },
        callbacks: {
          onopen: () => {
            if (!active()) return;
            window.clearTimeout(timeout);
            connectedAtRef.current ??= Date.now();
            setEverConnected(true);
            setPhase((p) => (p === "connecting" ? "listening" : p));
          },
          onmessage: onMessage,
          onerror: () => fail("The live connection dropped."),
          onclose: (e: CloseEvent) => {
            if (!active() || closingOnPurpose) return;
            if (e.code !== 1000 && e.reason) {
              fail("The live session closed unexpectedly.");
              return;
            }
            stopped = true;
            setPhase("ended");
            teardown();
          },
        },
      });

      if (!active()) {
        try {
          live.close();
        } catch {
          // ignore
        }
        return;
      }
      session = live;
      sessionRef.current = live;
      live.sendClientContent({ turns: [{ role: "user", parts: [{ text: openingTurn(name) }] }], turnComplete: true });
    };

    start().catch((e: unknown) => {
      if (!active() || abort.signal.aborted) return;
      fail(e instanceof LiveVoiceError ? e.message : "Live voice could not start.");
    });

    return () => {
      alive = false;
      abort.abort();
      teardown();
    };
  }, [attempt, name, goal]);

  // Mute simply stops sending audio; tell the server the stream paused, once.
  useEffect(() => {
    mutedRef.current = muted;
    micStreamRef.current?.getAudioTracks().forEach((t) => (t.enabled = !muted));
    if (muted && sessionRef.current && !streamEndedRef.current) {
      try {
        sessionRef.current.sendRealtimeInput({ audioStreamEnd: true });
        streamEndedRef.current = true;
      } catch {
        // ignore
      }
    }
  }, [muted]);

  const retry = useCallback(() => {
    setError(null);
    setPhase("connecting");
    setCoach({ id: 0, text: "" });
    setUser({ id: 0, text: "" });
    setAttempt((a) => a + 1);
  }, []);

  const finish = useCallback(() => {
    const started = connectedAtRef.current;
    // Never log rest for a session that never connected.
    const minutes = started ? Math.max(1, Math.round((Date.now() - started) / 60000)) : 0;
    onEnd(minutes);
  }, [onEnd]);

  const status =
    phase === "connecting"
      ? "Connecting"
      : phase === "speaking"
        ? "Speaking"
        : phase === "listening"
          ? muted
            ? "Muted"
            : "Listening"
          : phase === "ended"
            ? "Ended"
            : "";

  const isLive = phase === "listening" || phase === "speaking";

  return (
    <div className="flex flex-col items-center pb-2 pt-4 text-center">
      {/* Orb */}
      <div className="relative grid h-[220px] w-[220px] place-items-center" aria-hidden>
        <div
          ref={haloRef}
          className="absolute inset-0 rounded-full bg-moss-soft opacity-40 blur-2xl will-change-transform"
        />
        <div
          ref={orbRef}
          className={cn(
            "relative h-[200px] w-[200px] rounded-full will-change-transform",
            "transition-opacity duration-700",
            phase === "connecting" || phase === "ended" || phase === "error" ? "opacity-70" : "opacity-100",
          )}
          style={{ transform: "scale(0.9)" }}
        >
          <Illustration kind="breath" className="h-full w-full" />
        </div>
      </div>

      {/* Status word */}
      <div className="mt-6 grid h-4 place-items-center" aria-live="polite">
        <AnimatePresence initial={false}>
          <motion.div
            key={status || "none"}
            className="eyebrow [grid-area:1/1]"
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={fade}
          >
            {status}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Lines */}
      <div className="mt-5 grid min-h-[7.5rem] w-full max-w-sm place-items-center">
        <AnimatePresence initial={false}>
          {phase === "error" ? (
            <motion.p
              key="error"
              className="text-[15px] leading-6 text-ink-soft [grid-area:1/1]"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={fade}
              role="alert"
            >
              {error}
            </motion.p>
          ) : coach.text ? (
            <motion.p
              key={`coach-${coach.id}`}
              className="font-display text-xl leading-snug text-ink [grid-area:1/1]"
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={fade}
            >
              {tail(coach.text)}
            </motion.p>
          ) : null}
        </AnimatePresence>
      </div>
      <div className="mt-2 grid min-h-5 w-full max-w-sm place-items-center">
        <AnimatePresence initial={false}>
          {phase !== "error" && user.text ? (
            <motion.p
              key={`user-${user.id}`}
              className="text-[13px] leading-5 text-ink-faint [grid-area:1/1]"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={fade}
            >
              {tail(user.text)}
            </motion.p>
          ) : null}
        </AnimatePresence>
      </div>

      {/* Controls */}
      <div className="mt-8 flex w-full items-center justify-center gap-3">
        {phase === "error" || phase === "ended" ? (
          <>
            <Button variant={everConnected ? "soft" : "primary"} icon={RotateCcw} onClick={retry}>
              Try again
            </Button>
            {everConnected ? <Button onClick={finish}>Finish</Button> : null}
          </>
        ) : (
          <>
            <IconButton
              icon={muted ? MicOff : Mic}
              label={muted ? "Unmute microphone" : "Mute microphone"}
              aria-pressed={muted}
              onClick={() => setMuted((m) => !m)}
              disabled={!isLive}
              className={cn("h-12 w-12 border border-line bg-surface", muted && "bg-clay-soft text-ink")}
            />
            <Button size="lg" onClick={finish} className="min-w-[9rem]">
              Finish
            </Button>
          </>
        )}
      </div>
    </div>
  );
}
