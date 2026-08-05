import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["evals/skills-rules/**/*.eval.ts"],
    testTimeout: 300_000,
    hookTimeout: 300_000,
    reporters: ["default", "vitest-evals/reporter"],
  },
});
