/** A short yoga nidra–style body scan. Durations are in seconds at the 10-minute length. */
export const NIDRA_STEPS: { title: string; cue: string; seconds: number }[] = [
  { title: "Arrive", cue: "Lie down or sit back. Let your eyes close. Nothing to do for the next few minutes.", seconds: 45 },
  { title: "Breathe", cue: "Breathe in slowly through the nose. Let the out-breath be a little longer than the in-breath.", seconds: 75 },
  { title: "Intention", cue: "Quietly choose one short intention for tonight. Repeat it once, then let it go.", seconds: 45 },
  { title: "Right side", cue: "Bring attention to the right hand, the arm, the shoulder, the right leg and foot. Let each part soften.", seconds: 90 },
  { title: "Left side", cue: "Now the left hand, the arm, the shoulder, the left leg and foot. Heavy and still.", seconds: 90 },
  { title: "Whole body", cue: "Feel the whole body at once, resting, supported, completely at ease.", seconds: 75 },
  { title: "Stillness", cue: "Rest in the quiet. If thoughts come, let them pass like clouds.", seconds: 120 },
  { title: "Return", cue: "Deepen the breath. Move your fingers and toes. When you're ready, open your eyes.", seconds: 60 },
];

export const LENGTHS = [5, 10, 15] as const;

export function stepsFor(minutes: number) {
  const base = NIDRA_STEPS.reduce((s, x) => s + x.seconds, 0);
  const factor = (minutes * 60) / base;
  return NIDRA_STEPS.map((s) => ({ ...s, seconds: Math.round(s.seconds * factor) }));
}
