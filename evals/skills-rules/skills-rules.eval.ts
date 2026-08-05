import { expect } from "vitest";
import { describeEval } from "vitest-evals";
import { createAgentBehaviorHarness } from "./harness.ts";
import { selectedScenarios } from "./scenarios.ts";

const harness = createAgentBehaviorHarness();

describeEval("AX-managed skills and rules", { harness }, (it) => {
  for (const scenario of selectedScenarios()) {
    it(scenario.id, async ({ run }) => {
      const output = (await run({ scenario })).output;
      const observed = output.observedBehaviors.map(behaviorId);

      expect(output.scenarioId).toBe(scenario.id);
      expect(output.runner).toMatch(/^(codex|claude)$/);
      expect(output.model.length).toBeGreaterThan(0);
      expect(output.profile).toBe(scenario.profile);
      expect(output.sourceChanged).toBe(false);
      expect(output.repositoryChanged, JSON.stringify(output, null, 2)).toBe(
        scenario.allowRepositoryWrite,
      );
      if (scenario.forbidden.includes("provider-write")) {
        expect(output.providerMutationCalls).toEqual([]);
      }
      for (const behavior of scenario.required) {
        expect(observed, JSON.stringify(output, null, 2)).toContain(behavior);
      }
      for (const behavior of scenario.forbidden) {
        expect(observed).not.toContain(behavior);
      }
      expect(output.evidence.length).toBeGreaterThan(0);
    });
  }
});

function behaviorId(value: string): string {
  return value.split(":", 1)[0]?.trim() ?? value;
}
