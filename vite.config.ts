import { defineConfig } from "vite";

export default defineConfig({
  base: "./",
  build: {
    assetsInlineLimit: 4096,
    target: "es2020",
    chunkSizeWarningLimit: 1200,
  },
  test: {
    include: ["tests/**/*.test.ts"],
    environment: "node",
  },
} as never);
