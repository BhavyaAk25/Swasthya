"use client";

import { useReducedMotion } from "framer-motion";
import { useCallback, useEffect, useRef, useState, useSyncExternalStore, type CSSProperties } from "react";

import { cn } from "@/lib/utils";

const subscribeVisibility = (notify: () => void) => {
  document.addEventListener("visibilitychange", notify);
  return () => document.removeEventListener("visibilitychange", notify);
};
const documentVisible = () => document.visibilityState !== "hidden";
const serverVisible = () => false;

/** Follow a guided-session clock without repeatedly interrupting normal video playback. */
function syncPhase(element: HTMLVideoElement, phase: number | undefined, paused: boolean) {
  const duration = element.duration;
  if (phase === undefined || !Number.isFinite(duration) || duration <= 0) return;
  const target = ((phase % duration) + duration) % duration;
  const current = element.currentTime % duration;
  const difference = Math.abs(target - current);
  const drift = Math.min(difference, duration - difference);
  if (paused || drift > 0.25) element.currentTime = target;
}

/** The opaque colour behind an element: plate artwork is multiplied onto exactly this. */
function backdropOf(element: HTMLElement | null) {
  for (let node = element; node; node = node.parentElement) {
    const color = getComputedStyle(node).backgroundColor;
    if (color && color !== "transparent" && !/,\s*0\)$/.test(color)) return color;
  }
  return "#ffffff";
}

/** A covered or offscreen scene pauses without losing its playback position. */
export function useMotionActivity(host: React.RefObject<HTMLElement | null>, active: boolean) {
  const reduced = Boolean(useReducedMotion());
  const visible = useSyncExternalStore(subscribeVisibility, documentVisible, serverVisible);
  const [inView, setInView] = useState(false);
  useEffect(() => {
    const element = host.current;
    if (!element) return;
    const observer = new IntersectionObserver(([entry]) => setInView(entry.isIntersecting), { threshold: 0.01 });
    observer.observe(element);
    return () => observer.disconnect();
  }, [host]);
  return { reduced, running: active && visible && inView && !reduced };
}

/** Fixed-size media stage: no camera refitting, pose dissolves, crop, or character scaling. */
export function CharacterPlayer({
  poster, video, active = true, playing = true, loop = true, showVideo = true, cycle, aspectRatio = 3 / 2, blendPlate = false, className, label, onTime, onDone, onFailure,
}: {
  poster: string;
  video?: string;
  active?: boolean;
  playing?: boolean;
  loop?: boolean;
  showVideo?: boolean;
  /** Optional clock in seconds, wrapped to the movie's duration (guided breathing). */
  cycle?: number;
  aspectRatio?: number;
  /**
   * White-plate artwork: painted into one canvas as backdrop × media (canvas "multiply"), so the
   * white plate becomes exactly the surrounding colour. No CSS blend modes, which some browsers
   * drop for animating layers (a white or black panel behind the figure).
   */
  blendPlate?: boolean;
  className?: string;
  label?: string;
  onTime?: (seconds: number) => void;
  onDone?: () => void;
  onFailure?: () => void;
}) {
  const host = useRef<HTMLDivElement>(null);
  const player = useRef<HTMLVideoElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const { reduced, running } = useMotionActivity(host, active);
  const pendingReveal = useRef<{ element: HTMLVideoElement; id: number } | null>(null);
  const [readySource, setReadySource] = useState<string>();
  const [failed, setFailed] = useState(false);
  const [painted, setPainted] = useState(false);
  const displayVideo = Boolean(video && readySource === video && !failed && showVideo && !reduced);
  const cancelReveal = useCallback(() => {
    const pending = pendingReveal.current;
    if (pending) pending.element.cancelVideoFrameCallback(pending.id);
    pendingReveal.current = null;
  }, []);
  const revealPresentedFrame = useCallback((element: HTMLVideoElement) => {
    if (!video || readySource === video || !running || !playing) return;
    cancelReveal();
    if (blendPlate) {
      // Drawn into a canvas (see below), so the first decoded frame is enough.
      if (element.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) setReadySource(video);
    } else if (typeof element.requestVideoFrameCallback === "function") {
      // One callback per source reveal, not an animation loop. Wait until the
      // decoded first frame reaches the compositor before replacing the poster.
      pendingReveal.current = {
        element,
        id: element.requestVideoFrameCallback(() => {
          pendingReveal.current = null;
          setReadySource(video);
        }),
      };
    } else if (element.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) {
      setReadySource(video);
    }
  }, [video, readySource, running, playing, cancelReveal, blendPlate]);

  // Plate media: every still and video frame is painted as backdrop × artwork in one canvas.
  useEffect(() => {
    const surface = canvas.current;
    const ctx = surface?.getContext("2d");
    if (!blendPlate || !surface || !ctx) return;
    let backdrop = backdropOf(host.current?.parentElement ?? null);
    let last: [CanvasImageSource, number, number] | null = null;
    const paint = (source: CanvasImageSource, width: number, height: number) => {
      last = [source, width, height];
      if (surface.width !== width) surface.width = width;
      if (surface.height !== height) surface.height = height;
      // Draw the artwork, then multiply the backdrop over it (same result as backdrop × artwork).
      // This order matters: Safari/WebKit ignores the composite mode when drawing a <video> frame,
      // but always honours it for fillRect.
      ctx.globalCompositeOperation = "source-over";
      ctx.drawImage(source, 0, 0, width, height);
      ctx.globalCompositeOperation = "multiply";
      ctx.fillStyle = backdrop;
      ctx.fillRect(0, 0, width, height);
      ctx.globalCompositeOperation = "source-over";
      setPainted(true);
    };
    // Evening tones change the page colour: repaint at once so the plate keeps matching it.
    const theme = new MutationObserver(() => {
      backdrop = backdropOf(host.current?.parentElement ?? null);
      if (last) paint(...last);
    });
    theme.observe(document.documentElement, { attributes: true, attributeFilter: ["data-mode"] });

    const element = player.current;
    if (displayVideo && element) {
      const draw = () => {
        if (element.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA && element.videoWidth) paint(element, element.videoWidth, element.videoHeight);
      };
      draw();
      if (!running || !playing) return () => theme.disconnect();
      // Paint each decoded frame exactly once; animation frames are the fallback.
      if (typeof element.requestVideoFrameCallback === "function") {
        let id = 0;
        const onFrame = () => {
          draw();
          id = element.requestVideoFrameCallback(onFrame);
        };
        id = element.requestVideoFrameCallback(onFrame);
        return () => {
          theme.disconnect();
          element.cancelVideoFrameCallback(id);
        };
      }
      let id = 0;
      const loop = () => {
        draw();
        id = requestAnimationFrame(loop);
      };
      id = requestAnimationFrame(loop);
      return () => {
        theme.disconnect();
        cancelAnimationFrame(id);
      };
    }

    // Still artwork: paint once loaded (the last video frame stays until then, so no flash).
    const image = new Image();
    let live = true;
    image.onload = () => live && paint(image, image.naturalWidth, image.naturalHeight);
    image.src = poster;
    return () => {
      live = false;
      theme.disconnect();
    };
  }, [blendPlate, displayVideo, running, playing, poster]);

  useEffect(() => {
    if (!running || !playing) cancelReveal();
    return cancelReveal;
  }, [video, running, playing, cancelReveal]);
  const mediaStyle: CSSProperties = {
    aspectRatio,
    width: `min(100cqw, ${aspectRatio * 100}cqh)`,
  };

  useEffect(() => {
    const element = player.current;
    if (!element) return;
    if (!running || !playing || failed) {
      element.pause();
      return;
    }
    void element.play().catch((cause: unknown) => {
      if (cause instanceof DOMException && cause.name === "AbortError") return;
      setFailed(true);
      onFailure?.();
    });
    return () => element.pause();
  }, [running, playing, failed, video, onFailure]);

  useEffect(() => {
    const element = player.current;
    if (element) syncPhase(element, cycle, !running || !playing);
  }, [cycle, running, playing]);

  const videoElement = video ? (
    <video
      ref={player}
      src={video}
      poster={blendPlate ? undefined : poster}
      muted
      playsInline
      loop={loop}
      preload={running && !reduced ? "auto" : "none"}
      aria-hidden
      style={blendPlate ? undefined : mediaStyle}
      className={cn(
        blendPlate
          ? "pointer-events-none absolute inset-0 h-full w-full opacity-0"
          : "character-media absolute inset-0 m-auto h-auto max-h-full max-w-full object-contain",
        !blendPlate && (displayVideo ? "opacity-100" : "opacity-0"),
      )}
      onLoadedData={(event) => revealPresentedFrame(event.currentTarget)}
      onPlaying={(event) => revealPresentedFrame(event.currentTarget)}
      onLoadedMetadata={(event) => syncPhase(event.currentTarget, cycle, !running || !playing)}
      onTimeUpdate={(event) => onTime?.(event.currentTarget.currentTime)}
      onEnded={onDone}
      onError={() => { cancelReveal(); setFailed(true); onFailure?.(); }}
    />
  ) : null;

  if (blendPlate) {
    // The decoding <video> is invisible; the canvas shows its frames on the exact backdrop.
    return (
      <div ref={host} style={{ containerType: "size" }} className={cn("relative min-w-0 overflow-hidden", className)} role={label ? "img" : undefined} aria-label={label} aria-hidden={label ? undefined : true}>
        {videoElement}
        <canvas
          ref={canvas}
          aria-hidden
          style={{ ...mediaStyle, opacity: painted ? 1 : 0, transition: "opacity 500ms ease" }}
          className="pointer-events-none absolute inset-0 m-auto h-auto max-h-full max-w-full"
        />
      </div>
    );
  }

  return (
    <div ref={host} style={{ containerType: "size" }} className={cn("relative min-w-0 overflow-hidden", className)} role={label ? "img" : undefined} aria-label={label} aria-hidden={label ? undefined : true}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={poster} alt="" draggable={false} style={{ ...mediaStyle, visibility: displayVideo ? "hidden" : "visible" }} className="character-media absolute inset-0 m-auto h-auto max-h-full max-w-full select-none object-contain" />
      {videoElement}
    </div>
  );
}
