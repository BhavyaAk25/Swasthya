/**
 * Soft radial-gradient stages behind the illustrated friends. One definition feeds both the CSS
 * background of the panel and the canvas painter in CharacterPlayer, so the characters' white
 * plates turn into exactly the gradient behind them (no box) in every browser.
 */
export interface Stage {
  /** Ellipse centre as a fraction of the panel's width / height. */
  cx: number;
  cy: number;
  /** Ellipse radii as a fraction of the panel's width / height. */
  rx: number;
  ry: number;
  stops: [number, string][];
}

export const STAGES = {
  /** Exercises: pale sage, lighter at the top. */
  sage: { cx: 0.5, cy: 0.1, rx: 1.1, ry: 1.0, stops: [[0, "#fbfaf6"], [0.55, "#eef1ec"], [1, "#e2e8e4"]] },
  /** Yoga nidra: light dusk purple. */
  dusk: { cx: 0.7, cy: 0.2, rx: 1.2, ry: 1.1, stops: [[0, "#f8f5f1"], [0.55, "#ece7ee"], [1, "#e0d9e3"]] },
} satisfies Record<string, Stage>;

export type StageName = keyof typeof STAGES;

const pct = (v: number) => `${Math.round(v * 1000) / 10}%`;

/** CSS for a panel: spread onto its `style` together with `data-stage={name}`. */
export function stageStyle(name: StageName) {
  const s: Stage = STAGES[name];
  return {
    background: `radial-gradient(${pct(s.rx)} ${pct(s.ry)} at ${pct(s.cx)} ${pct(s.cy)}, ${s.stops.map(([at, c]) => `${c} ${pct(at)}`).join(", ")})`,
  };
}
