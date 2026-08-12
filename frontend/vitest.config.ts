import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./vitest.setup.ts"],
    include: ["__tests__/**/*.test.{ts,tsx}"],
    coverage: { reporter: ["text", "html"], thresholds: { lines: 80, functions: 80, branches: 80, statements: 80 } },
  },
  resolve: { alias: { "@": path.resolve(__dirname, ".") } },
});
