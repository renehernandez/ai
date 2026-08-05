export type EvalRunner = "codex" | "claude";

export type EvalLane = {
  runner: EvalRunner;
  model: string;
};

export function readEvalLane(env: NodeJS.ProcessEnv = process.env): EvalLane {
  const runner = env.AX_EVAL_RUNNER;
  const model = env.AX_EVAL_MODEL?.trim();

  if (runner !== "codex" && runner !== "claude") {
    throw new Error("eval_setup_error: set AX_EVAL_RUNNER to codex or claude");
  }
  if (!model) {
    throw new Error(
      "eval_setup_error: set AX_EVAL_MODEL to the exact model identifier",
    );
  }

  return { runner, model };
}
