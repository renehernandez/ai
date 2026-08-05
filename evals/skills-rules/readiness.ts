import type { EvalLane } from "./lane.ts";

export type EvalLaneEvidence = EvalLane & {
  head: string;
  status: "passed" | "failed";
};

export function validateFinalEvalReadiness(
  evidence: readonly EvalLaneEvidence[],
  expectedHead: string,
): void {
  if (!expectedHead.trim()) {
    throw new Error("eval_readiness_head_missing");
  }
  for (const runner of ["codex", "claude"] as const) {
    const current = evidence.filter(
      (entry) => entry.runner === runner && entry.head === expectedHead,
    );
    if (current.length !== 1 || current[0].status !== "passed") {
      throw new Error(`eval_readiness_lane_incomplete:${runner}`);
    }
    if (!current[0].model.trim()) {
      throw new Error(`eval_readiness_model_missing:${runner}`);
    }
  }
}
