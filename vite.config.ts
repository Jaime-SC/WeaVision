/// <reference types="vitest/config" />
import { defineConfig } from "vite";

export default defineConfig({
  base: "./", // Electron loads dist/ from file:// and Capacitor from its own scheme.
  test: { include: ["tests/unit/**/*.test.ts"] },
  build: { target: "es2022", chunkSizeWarningLimit: 900 },
});
