"use client";

import { useReducedMotion } from "framer-motion";
import { useId } from "react";

import { VISUALS } from "@/lib/images";
import { cn } from "@/lib/utils";

/** Local decorative SVG assets; adjacent controls and text provide their accessible names. */
export function Illustration({ kind, className }: { kind: keyof typeof VISUALS; className?: string }) {
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={VISUALS[kind]} alt="" aria-hidden className={cn("object-contain", className)} />;
}

/** The approved tide artwork, driven by the session clock or a gentle idle CSS cycle. */
export function BreathingTide({ level, className }: { level?: number; className?: string }) {
  const id = useId();
  const reducedMotion = useReducedMotion();
  const url = (name: string) => `url(#${id}-${name})`;
  const offset = reducedMotion ? 0 : 6 - 12 * Math.min(1, Math.max(0, level ?? 0.5));

  return (
    <svg viewBox="66 24 188 200" className={cn("h-full w-full", className)} aria-hidden focusable="false">
      <defs>
        <radialGradient id={`${id}-porcelain`} cx="30%" cy="15%" r="95%">
          <stop stopColor="#fffef9" /><stop offset=".58" stopColor="#eee9de" /><stop offset="1" stopColor="#c8c3b5" />
        </radialGradient>
        <radialGradient id={`${id}-sage`} cx="25%" cy="20%" r="85%">
          <stop stopColor="#c3d5c5" /><stop offset=".52" stopColor="#9bb6a3" /><stop offset="1" stopColor="#628575" />
        </radialGradient>
        <radialGradient id={`${id}-moss`} cx="20%" cy="15%" r="95%">
          <stop stopColor="#7c9b86" /><stop offset=".5" stopColor="#4d7460" /><stop offset="1" stopColor="#304f43" />
        </radialGradient>
        <filter id={`${id}-shadow`} x="-50%" y="-50%" width="200%" height="220%">
          <feDropShadow dx="0" dy="5" stdDeviation="6" floodColor="#3d5145" floodOpacity=".14" />
        </filter>
        <clipPath id={`${id}-disc`}><circle cx="160" cy="117" r="80" /></clipPath>
      </defs>
      <ellipse cx="160" cy="218" rx="67" ry="7" fill="#536d5c" opacity=".1" />
      <circle cx="160" cy="117" r="89" fill="#a9c1ae" opacity=".2" />
      <circle cx="160" cy="117" r="82" fill={url("porcelain")} filter={url("shadow")} />
      <g clipPath={url("disc")}>
        <circle cx="160" cy="117" r="80" fill="#e6ece3" />
        <circle cx="139" cy="82" r="32" fill="#fbfaf2" opacity=".7" />
        <g className={level === undefined ? "tide-idle" : undefined} style={{ transform: `translateY(${offset}px)`, transition: level !== undefined && !reducedMotion ? "transform .25s linear" : undefined }} data-tide-offset={offset.toFixed(3)}>
          <path d="M65 129 C98 109 123 137 160 122 C197 107 224 122 260 104 V220H65Z" fill="#b9cbbb" />
          <path d="M65 157 C104 130 137 163 174 144 C204 129 232 145 260 131 V220H65Z" fill={url("sage")} />
          <path d="M65 179 C102 164 136 187 174 169 C211 150 238 170 260 159 V220H65Z" fill={url("moss")} />
          <path d="M95 146 C119 142 132 152 152 150" fill="none" stroke="#f4f7ed" strokeWidth="1.4" opacity=".65" />
        </g>
      </g>
      <circle cx="160" cy="117" r="80" fill="none" stroke="#fffdf6" strokeOpacity=".64" strokeWidth="2" />
    </svg>
  );
}
