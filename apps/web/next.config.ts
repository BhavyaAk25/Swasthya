import type { NextConfig } from "next";
import path from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = path.dirname(fileURLToPath(import.meta.url));

const nextConfig: NextConfig = {
  output: "standalone",
  transpilePackages: ["@mediapipe/tasks-vision"],
  turbopack: {
    root: rootDir,
  },
};

export default nextConfig;
