import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

// Vitest config for the pure-logic unit tests (e.g. the AMM math in
// src/lib/trade.ts). The `@` alias mirrors tsconfig.json's paths so tests can
// import modules the same way the app does.
export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
});
