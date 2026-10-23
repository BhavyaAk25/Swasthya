import type { MetadataRoute } from "next";

/** Installable app: opens full-screen from the home screen and works offline (see public/sw.js). */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Swasthya",
    short_name: "Swasthya",
    description: "A calm space to eat well, move daily and rest deeply.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#f4f1ea",
    theme_color: "#f4f1ea",
    categories: ["health", "fitness", "lifestyle"],
    icons: [
      { src: "/brand/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/brand/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/brand/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
