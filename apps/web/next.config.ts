import type { NextConfig } from "next";
import path from "node:path";
import { fileURLToPath } from "node:url";

const nextConfig: NextConfig = {
  // Lets an extra preview server (e.g. an agent's) run beside `npm run dev` without sharing the .next lock.
  distDir: process.env.NEXT_DIST_DIR || ".next",
  turbopack: { root: path.dirname(fileURLToPath(import.meta.url)) },
};

export default nextConfig;
