"use client";

import dynamic from "next/dynamic";

export { HeroScene, ExerciseDemoScene, RestoreScene } from "@/components/characters/scenes";
export { preloadCharacters } from "@/components/characters/assets";

// The meal bowl is the only scene that needs WebGL. Character scenes use local illustrated media.
// No placeholder art while it loads: a stand-in plate of food would contradict an empty bowl.
export const PlateScene = dynamic(() => import("@/components/three/plate").then((module) => module.PlateScene), {
  ssr: false,
  loading: () => <div aria-hidden className="h-full w-full" />,
});
