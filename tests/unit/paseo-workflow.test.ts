// charter-contracts: pi-paseo-workflow
import assert from "node:assert/strict";
import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import {
  collectReviews,
  dispatchReview,
  handoff,
  initialize,
  monitor,
  parseReview,
  routesFromConfig,
  type Transport,
  transition,
  type Workflow,
} from "../../skills/handoff-brief/scripts/paseo-workflow.ts";

async function fixture() {
  const dir = await mkdtemp(join(tmpdir(), "paseo-workflow-"));
  const path = join(dir, "state.json");
  const configPath = join(dir, "config.json");
  const roles = [
    "planner",
    "implementer",
    "review-glm",
    "review-deepseek",
    "review-astra",
  ];
  const config = {
    agents: {
      providers: Object.fromEntries(
        roles.map((role) => [
          `ax-${role}`,
          {
            extends: "pi",
            command: [
              "node",
              "/managed/hooks/pi/launch.ts",
              role,
              "openai-codex",
              `model-${role}`,
              "low",
            ],
            models: [{ id: `openai-codex/model-${role}` }],
          },
        ]),
      ),
    },
  };
  await writeFile(configPath, JSON.stringify(config));
  await initialize(path, { cwd: dir, configPath });
  const artifactPath = join(dir, "artifact.md");
  await writeFile(
    artifactPath,
    "Objective: test the accepted behavior. Exact target evidence: test fixture.",
  );
  const calls: string[][] = [];
  const sessions = new Map<
    string,
    { provider: string; model: string; thinking: string; prompt: string }
  >();
  const transport: Transport = async (args) => {
    calls.push(args);
    if (args[0] === "run") {
      const agentId = `agent-${sessions.size}`;
      const flag = (name: string) => args[args.indexOf(name) + 1];
      sessions.set(agentId, {
        provider: flag("--provider"),
        model: flag("--model"),
        thinking: flag("--thinking"),
        prompt: args[args.length - 1],
      });
      return JSON.stringify({ agentId });
    }
    const agentId = args[args.length - 1];
    const session = sessions.get(agentId);
    assert.ok(session);
    if (args[0] === "wait") return JSON.stringify({ agentId, status: "idle" });
    if (args[0] === "inspect")
      return JSON.stringify({
        Id: agentId,
        Provider: session.provider,
        Model: session.model,
        Thinking: session.thinking,
        Status: "idle",
        PendingPermissions: [],
      });
    const state = JSON.parse(await readFile(path, "utf8")) as Workflow;
    const phase = session.prompt.includes("this planning")
      ? "planning"
      : "implementation";
    return `AX_REVIEW_BEGIN${JSON.stringify({ fingerprint: state.rounds[phase]?.fingerprint, outcomes: Object.fromEntries(state.lenses[phase].map((lens) => [lens.id, { status: "passed", evidence: "Inspected exact fixture behavior; no scoped issue.", findings: [] }])) })}AX_REVIEW_END`;
  };
  const read = async () => JSON.parse(await readFile(path, "utf8")) as Workflow;
  const review = async (phase: "planning" | "implementation") => {
    await dispatchReview(
      path,
      { phase, artifactPath, head: "first" },
      transport,
    );
    await collectReviews(path, { phase }, transport);
    await transition(path, "triage", { phase, decisions: [] });
  };
  return {
    path,
    dir,
    config,
    configPath,
    artifactPath,
    calls,
    sessions,
    transport,
    read,
    review,
  };
}

test("GREEN pi-paseo-workflow: deliberate handoff reaches Ready once without spawning review loops", async () => {
  const f = await fixture();
  await f.review("planning");
  await handoff(
    f.path,
    {
      briefPath: f.artifactPath,
      planResolution: "All reviewer outcomes inspected; no findings.",
    },
    f.transport,
  );
  await f.review("implementation");
  const receipt = {
    artifactUrl: "https://github.com/owner/repo/pull/1",
    head: "first",
    reviewer: "genie",
    ready: true,
    evidence: "Finish inspected provider head and Ready state.",
  };
  await transition(f.path, "publication", receipt);
  await monitor(f.path, { probeCommand: ["finish-probe"] }, async () =>
    JSON.stringify({ ...receipt, status: "completed", findings: [] }),
  );
  await transition(f.path, "triage", { phase: "hosted", decisions: [] });
  const finished = await transition(f.path, "finish", receipt);
  assert.equal(
    finished.finished,
    "Finish inspected provider head and Ready state.",
  );
  assert.equal((await f.read()).finished, receipt.evidence);
  assert.equal(f.calls.filter((args) => args[0] === "run").length, 6);
  assert.equal(new Set(f.sessions.keys()).size, 6);
  assert.ok(
    f.calls
      .filter((args) => args[0] === "run")
      .every((args) => !args.includes("--output-schema")),
  );
  await assert.rejects(
    collectReviews(f.path, { phase: "planning" }, f.transport),
    /already finished/,
  );
  await assert.rejects(
    dispatchReview(
      f.path,
      { phase: "planning", artifactPath: f.artifactPath },
      f.transport,
    ),
    /already finished/,
  );
  await assert.rejects(
    handoff(
      f.path,
      { briefPath: f.artifactPath, planResolution: "No rerun." },
      f.transport,
    ),
    /already finished/,
  );
});

test("RED pi-paseo-workflow: repeated phase cannot dispatch another review", async () => {
  const f = await fixture();
  await dispatchReview(
    f.path,
    { phase: "planning", artifactPath: f.artifactPath },
    f.transport,
  );
  await assert.rejects(
    dispatchReview(
      f.path,
      { phase: "planning", artifactPath: f.artifactPath },
      f.transport,
    ),
    /already dispatched/,
  );
  assert.equal(f.calls.length, 2);
});

test("parallel phase callers reserve each reviewer only once", async () => {
  const f = await fixture();
  const results = await Promise.allSettled(
    [1, 2].map(() =>
      dispatchReview(
        f.path,
        { phase: "planning", artifactPath: f.artifactPath },
        f.transport,
      ),
    ),
  );
  assert.equal(results.filter((item) => item.status === "rejected").length, 1);
  assert.equal(f.calls.length, 2);
  assert.ok(
    Object.values((await f.read()).rounds.planning?.reviews ?? {}).every(
      (review) => review.status === "running",
    ),
  );
});

test("uncertain launch and malformed outputs remain failed without retry", async () => {
  const f = await fixture();
  await dispatchReview(
    f.path,
    { phase: "planning", artifactPath: f.artifactPath },
    async () => {
      throw new Error("lost response");
    },
  );
  await collectReviews(f.path, { phase: "planning" }, f.transport);
  await assert.rejects(
    transition(f.path, "triage", { phase: "planning", decisions: [] }),
    /incomplete or failed/,
  );
  assert.equal(f.calls.length, 0);
  const g = await fixture();
  await dispatchReview(
    g.path,
    { phase: "planning", artifactPath: g.artifactPath },
    g.transport,
  );
  await collectReviews(g.path, { phase: "planning" }, async (args, timeout) =>
    args[0] === "logs" ? "" : g.transport(args, timeout),
  );
  assert.ok(
    Object.values((await g.read()).rounds.planning?.reviews ?? {}).every(
      (review) => review.status === "failed",
    ),
  );
  await assert.rejects(
    handoff(
      g.path,
      { briefPath: g.artifactPath, planResolution: "Ignore empty response" },
      g.transport,
    ),
    /incomplete or failed/,
  );
});

test("actual session model mismatch rejects successful process output", async () => {
  const f = await fixture();
  await dispatchReview(
    f.path,
    { phase: "planning", artifactPath: f.artifactPath },
    f.transport,
  );
  await collectReviews(f.path, { phase: "planning" }, async (args, timeout) => {
    const output = await f.transport(args, timeout);
    return args[0] === "inspect"
      ? JSON.stringify({ ...JSON.parse(output), Model: "other" })
      : output;
  });
  assert.ok(
    Object.values((await f.read()).rounds.planning?.reviews ?? {}).every(
      (review) => review.status === "failed",
    ),
  );
});

test("canonical lenses cannot be omitted and incomplete report is rejected", async () => {
  const f = await fixture();
  const lenses = (await f.read()).lenses.planning;
  assert.ok(lenses.length >= 5);
  assert.throws(
    () =>
      parseReview(
        'AX_REVIEW_BEGIN{"fingerprint":"target","outcomes":{}}AX_REVIEW_END',
        "target",
        lenses,
      ),
    /Incomplete/,
  );
  f.config.agents.providers["ax-planner"].models[0].id = "override";
  assert.throws(() => routesFromConfig(f.config), /metadata differs/);
});

test("review reports reject duplicate findings and contradictory pass outcomes", () => {
  const lenses = [
    { id: "code-simplifier", objective: "Simplify without changing behavior." },
  ];
  const report = (
    status: string,
    findings: { id: string; evidence: string }[],
  ) =>
    `AX_REVIEW_BEGIN${JSON.stringify({ fingerprint: "target", outcomes: { "code-simplifier": { status, evidence: "Inspected source.", findings } } })}AX_REVIEW_END`;
  const finding = { id: "same-id", evidence: "Concrete defect." };
  assert.throws(
    () => parseReview(report("finding", [finding, finding]), "target", lenses),
    /Invalid outcome/,
  );
  assert.throws(
    () => parseReview(report("finding", []), "target", lenses),
    /Invalid outcome/,
  );
  assert.throws(
    () => parseReview(report("passed", [finding]), "target", lenses),
    /Invalid outcome/,
  );
});

test("one hosted repair batch is permitted and final receipt must match repaired head", async () => {
  const f = await fixture();
  await f.review("planning");
  await handoff(
    f.path,
    { briefPath: f.artifactPath, planResolution: "No findings." },
    f.transport,
  );
  await f.review("implementation");
  const receipt = {
    artifactUrl: "https://github.com/owner/repo/pull/1",
    head: "first",
    reviewer: "genie",
    ready: true,
    evidence: "Observed source.",
  };
  await transition(f.path, "publication", receipt);
  await monitor(f.path, { probeCommand: ["probe"] }, async () =>
    JSON.stringify({
      ...receipt,
      status: "completed",
      findings: [{ id: "finding-1", evidence: "Concrete defect." }],
    }),
  );
  await transition(f.path, "triage", {
    phase: "hosted",
    decisions: [{ id: "finding-1", action: "fix", reason: "Reproduced." }],
  });
  await transition(f.path, "repair", { phase: "hosted", stage: "start" });
  await transition(f.path, "repair", {
    phase: "hosted",
    stage: "complete",
    head: "second",
    verification: "Unit regression passes.",
  });
  await assert.rejects(
    transition(f.path, "repair", { phase: "hosted", stage: "start" }),
    /Only one/,
  );
  await assert.rejects(transition(f.path, "finish", receipt), /head differs/);
  await transition(f.path, "finish", {
    ...receipt,
    head: "second",
    evidence: "Second head observed Ready; hosted review only covered first.",
  });
  assert.equal((await f.read()).publication?.head, "second");
  await assert.rejects(
    monitor(f.path, { probeCommand: ["probe"] }),
    /already finished/,
  );
});

test("monitor quietly expires and does not infer success from missing hosted feedback", async () => {
  const f = await fixture();
  await f.review("planning");
  await handoff(
    f.path,
    { briefPath: f.artifactPath, planResolution: "No findings." },
    f.transport,
  );
  await f.review("implementation");
  const receipt = {
    artifactUrl: "https://github.com/owner/repo/pull/1",
    head: "first",
    reviewer: "genie",
    ready: true,
    evidence: "Observed source.",
  };
  await transition(f.path, "publication", receipt);
  let time = 0;
  let probes = 0;
  await monitor(
    f.path,
    { probeCommand: ["probe"], deadlineMs: 20, pollMs: 10 },
    async () => {
      probes++;
      return JSON.stringify({ ...receipt, status: "waiting", findings: [] });
    },
    async (ms) => {
      time += ms;
    },
    () => time,
  );
  assert.equal((await f.read()).hosted?.status, "timed-out");
  assert.equal(probes, 2);
  await assert.rejects(
    transition(f.path, "triage", { phase: "hosted", decisions: [] }),
    /has not completed/,
  );
});

test("implementation questions block publication and applicable fixes consume one verified repair batch", async () => {
  const f = await fixture();
  await f.review("planning");
  await handoff(
    f.path,
    { briefPath: f.artifactPath, planResolution: "No findings." },
    f.transport,
  );
  await dispatchReview(
    f.path,
    { phase: "implementation", artifactPath: f.artifactPath, head: "first" },
    f.transport,
  );
  await collectReviews(
    f.path,
    { phase: "implementation" },
    async (args, timeout) => {
      const output = await f.transport(args, timeout);
      if (args[0] !== "logs") return output;
      const report = JSON.parse(
        output.replace("AX_REVIEW_BEGIN", "").replace("AX_REVIEW_END", ""),
      );
      report.outcomes["code-simplifier"] = {
        status: "finding",
        evidence:
          "A duplicated branch can be removed without changing behavior.",
        findings: [
          {
            id: "duplicate-branch",
            evidence: "Both branches return the same value.",
          },
          { id: "extract-helper", evidence: "Consider extracting a helper." },
        ],
      };
      return `AX_REVIEW_BEGIN${JSON.stringify(report)}AX_REVIEW_END`;
    },
  );
  const decisions = ["review-glm", "review-deepseek", "review-astra"].flatMap(
    (role) =>
      ["duplicate-branch", "extract-helper"].map((findingId) => ({
        id: `${role}:code-simplifier:${findingId}`,
        action: "question" as const,
        reason: "Need user decision on behavior boundary.",
      })),
  );
  await transition(f.path, "triage", { phase: "implementation", decisions });
  const receipt = {
    artifactUrl: "https://github.com/owner/repo/pull/1",
    head: "first",
    reviewer: "genie" as const,
    ready: true as const,
    evidence: "Observed Ready.",
  };
  await assert.rejects(
    transition(f.path, "publication", receipt),
    /user input/,
  );
  await transition(f.path, "triage", {
    phase: "implementation",
    decisions: decisions.map((item) => ({
      ...item,
      action: item.id.endsWith("extract-helper") ? "dismiss" : "fix",
      reason: "User clarified; contract is preserved.",
    })),
  });
  await assert.rejects(
    transition(f.path, "publication", receipt),
    /completed verification/,
  );
  await transition(f.path, "repair", {
    phase: "implementation",
    stage: "start",
  });
  await transition(f.path, "repair", {
    phase: "implementation",
    stage: "complete",
    head: "repaired",
    verification: "Focused unit regression passes.",
  });
  await assert.rejects(
    transition(f.path, "repair", { phase: "implementation", stage: "start" }),
    /Only one/,
  );
  await assert.rejects(
    transition(f.path, "publication", receipt),
    /head differs/,
  );
  await transition(f.path, "publication", { ...receipt, head: "repaired" });
  assert.equal((await f.read()).publication?.head, "repaired");
});
