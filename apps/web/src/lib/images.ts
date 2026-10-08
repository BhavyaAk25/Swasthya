/**
 * Image slots used across the app. Each one renders a soft placeholder until you set a path.
 * Drop a file into /public/images and point the slot at it, e.g. hero: "/images/hero.jpg".
 */
export const IMAGES: Record<"hero" | "welcome" | "nourish" | "move" | "restore", string | null> = {
  welcome: null,
  hero: null,
  nourish: null,
  move: null,
  restore: null,
};
