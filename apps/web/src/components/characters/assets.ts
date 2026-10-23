/** Local, fixed-camera illustrations. Moving clips contain one complete seamless repetition. */
const ROOT = "/images/characters";

export type CharacterClip =
  | "squat" | "lunge" | "calf" | "stretch"
  | "bridge" | "pushup" | "pike" | "plank" | "row" | "deadbug"
  | "catcow" | "hip" | "twist" | "fold" | "rest";
export type Friend = "man" | "woman";
/** Physical arm-raise lead-in before the five approved 2.4-second squat repetitions. */
export const HERO_ENTRY_SECONDS = 0.6;

type Asset = { poster: string; video?: string; seconds: number };
const clipFile = (clip: CharacterClip, ext: "webp" | "mp4") => `${ROOT}/${clip}.${ext}?v=flat9`;
const still = (clip: CharacterClip, seconds: number): Asset => ({ poster: clipFile(clip, "webp"), seconds });
const motion = (clip: CharacterClip, seconds: number): Asset => ({ ...still(clip, seconds), video: clipFile(clip, "mp4") });

export const CHARACTER_ASSETS: Record<CharacterClip, Asset> = {
  squat: motion("squat", 2.4),
  lunge: motion("lunge", 2.6),
  calf: motion("calf", 1.8),
  stretch: motion("stretch", 5),
  bridge: motion("bridge", 2.6),
  pushup: motion("pushup", 2.2),
  pike: motion("pike", 2.2),
  plank: motion("plank", 5),
  row: motion("row", 2.2),
  deadbug: motion("deadbug", 4),
  catcow: motion("catcow", 5),
  hip: motion("hip", 6),
  twist: motion("twist", 4),
  fold: motion("fold", 5),
  rest: motion("rest", 10),
};

const EXERCISE_CLIP: Record<string, CharacterClip> = {
  squat: "squat", split: "lunge", lunge: "lunge", bridge: "bridge", calf: "calf",
  pushup: "pushup", pike: "pike", row: "row", plank: "plank", deadbug: "deadbug",
  cat: "catcow", hip: "hip", twist: "twist", fold: "fold",
};

export function characterClipFor(exerciseId: string): CharacterClip {
  return EXERCISE_CLIP[exerciseId] ?? "stretch";
}

export function friendAsset(who: Friend, state: "idle" | "happy" | "squat") {
  return `${ROOT}/${who}-${state}.${state === "squat" ? "mp4" : "webp"}?v=plate7`;
}

/** Warm only small hero stills; exercise movies load when their scene enters the viewport. */
export function preloadCharacters() {
  for (const who of ["man", "woman"] as const) {
    for (const state of ["idle", "happy"] as const) {
      const image = new Image();
      image.src = friendAsset(who, state);
    }
  }
}
