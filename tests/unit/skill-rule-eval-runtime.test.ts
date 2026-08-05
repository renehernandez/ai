import assert from "node:assert/strict";
import test from "node:test";
import { readEvalLane } from "../../evals/skills-rules/lane.ts";

test("eval runtime requires a supported runner", () => {
  assert.throws(
    () => readEvalLane({ AX_EVAL_MODEL: "gpt-test" }),
    /eval_setup_error: set AX_EVAL_RUNNER to codex or claude/,
  );
});

test("eval runtime requires an exact model identity", () => {
  assert.throws(
    () => readEvalLane({ AX_EVAL_RUNNER: "codex" }),
    /eval_setup_error: set AX_EVAL_MODEL to the exact model identifier/,
  );
});

test("eval runtime records the selected lane", () => {
  assert.deepEqual(
    readEvalLane({
      AX_EVAL_RUNNER: "claude",
      AX_EVAL_MODEL: "  claude-test  ",
    }),
    { runner: "claude", model: "claude-test" },
  );
});
