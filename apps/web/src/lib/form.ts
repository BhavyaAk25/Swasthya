/**
 * Short form guidance for every move in the plans (lib/plan.ts). General coaching cues, not
 * medical advice. The first cue is also spoken at the start of a move (lib/voice-phrases.ts),
 * so keep it to one short sentence. Keep this file free of imports: the voice recorder loads it.
 */
export interface Form {
  cues: [string, string, string];
  avoid: string;
}

export const FORM: Record<string, Form> = {
  squat: {
    cues: ["Sit back and down, chest tall.", "Knees track over your toes.", "Drive up through your whole foot."],
    avoid: "Heels lifting or knees caving in.",
  },
  split: {
    cues: ["Lower straight down, torso upright.", "Front knee stays over the ankle.", "Push through the front heel."],
    avoid: "Leaning forward or a too-short stance.",
  },
  lunge: {
    cues: ["Step back softly, hips square.", "Lower until both knees bend.", "Press through the front foot to stand."],
    avoid: "Front knee drifting inward.",
  },
  bridge: {
    cues: ["Press through your heels, lift the hips.", "Squeeze the glutes at the top.", "Lower slowly, one vertebra at a time."],
    avoid: "Arching the lower back to get higher.",
  },
  calf: {
    cues: ["Rise slowly onto the balls of your feet.", "Pause at the top.", "Lower with control."],
    avoid: "Bouncing through the reps.",
  },
  pushup: {
    cues: ["Hands under shoulders, body in one line.", "Lower your chest between your hands.", "Press the floor away."],
    avoid: "Hips sagging or elbows flaring wide.",
  },
  pike: {
    cues: ["Hips high, head between the arms.", "Bend the elbows to lower your head.", "Push back up through the shoulders."],
    avoid: "Letting the hips drop toward a push-up.",
  },
  row: {
    cues: ["Hinge forward with a flat back.", "Pull the bag to your lower ribs.", "Squeeze the shoulder blades, then lower."],
    avoid: "Rounding the back or jerking the weight.",
  },
  plank: {
    cues: ["Elbows under shoulders, body long.", "Brace your belly and squeeze the glutes.", "Breathe slowly and steadily."],
    avoid: "Hips too high or sagging.",
  },
  deadbug: {
    cues: ["Lower back gently pressed down.", "Extend one leg slowly, arms steady.", "Return, then switch sides."],
    avoid: "The lower back lifting off the mat.",
  },
  cat: {
    cues: ["Inhale, let the belly drop and look up.", "Exhale, round the spine toward the ceiling.", "Move slowly with your breath."],
    avoid: "Rushing or forcing the range.",
  },
  hip: {
    cues: ["Ease into each position.", "Breathe into the hips.", "Stay where it feels like a gentle stretch."],
    avoid: "Bouncing or pushing into pain.",
  },
  twist: {
    cues: ["Rotate from the upper back.", "Keep your hips still.", "Follow your hand with your eyes."],
    avoid: "Twisting from the lower back.",
  },
  fold: {
    cues: ["Hinge at the hips, knees soft.", "Let your head hang heavy.", "Roll up slowly to stand."],
    avoid: "Locking the knees or forcing the stretch.",
  },
};
