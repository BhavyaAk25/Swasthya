import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  globalIgnores([".next/**", ".next-*/**", "out/**", "build/**", "next-env.d.ts"]),
  {
    // three.js scenes mutate scene-graph objects inside useFrame by design (React Three Fiber).
    files: ["src/components/three/**/*.tsx"],
    rules: { "react-hooks/immutability": "off" },
  },
]);

export default eslintConfig;
