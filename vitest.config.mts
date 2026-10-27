import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  resolve: { alias: { "@": path.resolve(import.meta.dirname), "server-only": path.resolve(import.meta.dirname, "tests/stubs/server-only.ts") } },
  test: { include: ["tests/**/*.test.ts"], exclude: ["tests/e2e/**", "node_modules/**"], environment: "node" },
});
