import { expect } from "vitest";
import { describeEval } from "vitest-evals";
import { createHarness } from "vitest-evals/harness";
import { readEvalLane } from "./lane.ts";

const harness = createHarness<
  Record<string, never>,
  ReturnType<typeof readEvalLane>
>({
  name: "skills-rules-runtime-setup",
  run: async () => {
    const output = readEvalLane();
    return {
      output,
      events: [{ type: "message", role: "assistant", content: output }],
      artifacts: output,
      usage: { provider: output.runner, model: output.model },
    };
  },
});

describeEval("skills and rules eval runtime", { harness }, (it) => {
  it("records an explicit runner and model", async ({ run }) => {
    const { output } = await run({});
    expect(output.runner).toMatch(/^(codex|claude)$/);
    expect(output.model.trim().length).toBeGreaterThan(0);
    expect(output.model).toBe(output.model.trim());
  });
});
