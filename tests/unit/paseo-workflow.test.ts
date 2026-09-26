// charter-contracts: pi-paseo-workflow
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdtemp, readFile, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import test from "node:test";
import {
  assertActionGateDisposition,
  bindWorkspace,
  collectReviews,
  dispatchRepair,
  dispatchReview,
  handoff,
  initialize,
  loopStatus,
  main,
  monitor,
  parseReview,
  retryMisroutedHandoff,
  routesFromConfig,
  syncHeartbeat,
  type Transport,
  tick,
  tickPrompt,
  transition,
  type Workflow,
  type WorktreeReader,
} from "../../skills/handoff-brief/scripts/paseo-workflow.ts";
import { locked } from "../../skills/handoff-brief/scripts/paseo-workflow-state.ts";

const policySourceFingerprint = "a".repeat(64);
const targetBase = "b".repeat(40);
const orchestrator = { agentId: "orchestrator-0001" };
const startupReply = "Ready. Awaiting a verified follow-up assignment.";
const hex = (digit: number) => String(digit).repeat(40);
const heads = {
  first: hex(1),
  second: hex(2),
  repaired: hex(3),
  headA: hex(4),
  headB: hex(5),
  other: hex(6),
  unreported: hex(7),
};
const reportEnvelope = (report: Record<string, unknown>) =>
  `AX_REPORT_BEGIN${JSON.stringify(report)}AX_REPORT_END`;
const implementerReport = (head: string) => ({
  branch: "feature",
  head,
  commits: [`${head} Implement the fixture`],
  verification: ["Fixture unit tests pass."],
  deviations: [],
  risks: [],
});

async function fixture(
  gates: {
    ci: "required" | "not-required" | "unknown";
    reviewer: "required" | "not-required" | "unknown";
  } = {
    ci: "required",
    reviewer: "required",
  },
) {
  const dir = await mkdtemp(join(tmpdir(), "paseo-workflow-"));
  const path = join(dir, "state.json");
  const configPath = join(dir, "config.json");
  const roles = [
    "planner",
    "implementer",
    "review-correctness",
    "review-architecture",
    "review-contract",
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
  await transition(path, "policy", {
    deliveryPolicy: {
      provider: "github",
      repository: "owner/repo",
      ci: gates.ci,
      reviewer: gates.reviewer,
      ...(gates.reviewer === "required"
        ? { reviewerKind: "genie" as const }
        : {}),
      source: "fixture policy",
      sourceFingerprint: policySourceFingerprint,
    },
  });
  const artifactPath = join(dir, "artifact.md");
  await writeFile(
    artifactPath,
    "Objective: test the accepted behavior. Exact target evidence: test fixture.",
  );
  const calls: string[][] = [];
  const workspaceId = "workspace-fixture";
  const sessions = new Map<
    string,
    {
      provider: string;
      model: string;
      thinking: string;
      cwd: string;
      prompt: string;
      status: string;
    }
  >();
  const heartbeats = new Map<string, { agentId: string; prompt: string }>();
  let reportedHead = heads.first;
  let implementerReply: string | undefined;
  const tree: { branch: string; head?: string; uncommitted: string[] } = {
    branch: "feature",
    uncommitted: [],
  };
  const worktree: WorktreeReader = async () => ({
    branch: tree.branch,
    head: tree.head ?? reportedHead,
    uncommitted: tree.uncommitted,
  });
  let heartbeatIds = 0;
  let maxHeartbeats = 0;
  const transport: Transport = async (args, _timeout, env) => {
    calls.push(args);
    if (args[0] === "heartbeat" && args[1] === "create") {
      const agentId = env?.PASEO_AGENT_ID ?? "";
      const id = `heartbeat-${++heartbeatIds}`;
      heartbeats.set(id, { agentId, prompt: args[args.length - 1] });
      maxHeartbeats = Math.max(maxHeartbeats, heartbeats.size);
      return JSON.stringify({ id, target: `agent:${agentId.slice(0, 7)}` });
    }
    if (args[0] === "heartbeat" && args[1] === "delete") {
      if (!heartbeats.delete(args[2]))
        throw new Error(`Schedule not found: ${args[2]}`);
      return JSON.stringify({ id: args[2], status: "deleted" });
    }
    if (args[0] === "workspace" && args[1] === "ls")
      return JSON.stringify([{ workspaceId, cwd: dir }]);
    if (args[0] === "run") {
      const agentId = `agent-${sessions.size}`;
      const flag = (name: string) => args[args.indexOf(name) + 1];
      assert.equal(flag("--workspace"), workspaceId);
      sessions.set(agentId, {
        provider: flag("--provider"),
        model: flag("--model"),
        thinking: flag("--thinking"),
        cwd: flag("--cwd"),
        prompt: args[args.length - 1],
        status: "idle",
      });
      return JSON.stringify({ agentId });
    }
    if (args[0] === "send") {
      const agentId = args[1];
      const session = sessions.get(agentId);
      assert.ok(session);
      session.prompt = await readFile(
        args[args.indexOf("--prompt-file") + 1],
        "utf8",
      );
      return JSON.stringify({ agentId, status: "sent" });
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
        Status: session.status,
        Cwd: session.cwd,
        Archived: false,
        PendingPermissions: [],
      });
    if (session.prompt.startsWith("Start inertly")) return startupReply;
    if (session.provider === "ax-implementer")
      return (
        implementerReply ??
        `Implemented and committed through native hooks. Head: ${reportedHead}.\n${reportEnvelope(implementerReport(reportedHead))}`
      );
    const state = JSON.parse(await readFile(path, "utf8")) as Workflow;
    const phase = session.prompt.includes("this planning")
      ? "planning"
      : "implementation";
    const role = session.provider.replace(/^ax-/, "");
    const assigned = state.rounds[phase]?.lensAssignments[role]?.lensIds ?? [];
    return `AX_REVIEW_BEGIN${JSON.stringify({ fingerprint: state.rounds[phase]?.fingerprint, outcomes: Object.fromEntries(assigned.map((id) => [id, { status: "passed", evidence: "Inspected exact fixture behavior; no scoped issue.", findings: [] }])) })}AX_REVIEW_END`;
  };
  const read = async () => JSON.parse(await readFile(path, "utf8")) as Workflow;
  const step = (
    via: Transport = transport,
    probe?: Transport,
    now?: () => number,
  ) => tick(path, orchestrator, via, probe, now, worktree);
  const review = async (phase: "planning" | "implementation") => {
    await step();
    await dispatchReview(
      path,
      { phase, artifactPath, head: heads.first },
      transport,
    );
    await step();
    await transition(path, "triage", { phase, decisions: [] });
  };
  const accept = async (planResolution = "Settled.") => {
    await handoff(path, { briefPath: artifactPath, planResolution }, transport);
    await step();
  };
  const repairBrief = join(dir, "repair-brief.md");
  await writeFile(repairBrief, "Repair the triaged findings only.");
  const repair = async (
    phase: "implementation" | "hosted",
    head: string,
    verification = "Focused regression passes.",
  ) => {
    reportedHead = head;
    await dispatchRepair(path, { phase, briefPath: repairBrief }, transport);
    await step();
    await transition(path, "repair", {
      phase,
      stage: "complete",
      head,
      verification,
    });
  };
  return {
    path,
    dir,
    config,
    configPath,
    artifactPath,
    repairBrief,
    calls,
    sessions,
    reportHead: (head: string) => {
      reportedHead = head;
    },
    replyWith: (text: string) => {
      implementerReply = text;
    },
    tree,
    heartbeats,
    maxHeartbeats: () => maxHeartbeats,
    transport,
    read,
    step,
    review,
    accept,
    repair,
  };
}

const hostedReceipt = {
  artifactUrl: "https://github.com/owner/repo/pull/1",
  head: heads.first,
  targetBase,
  reviewer: "genie" as const,
  ready: true as const,
  evidence: "Observed source.",
  policySourceFingerprint,
  probeCommand: ["finish-probe"],
};
const probeReturning =
  (status: string, findings: { id: string; evidence: string }[] = []) =>
  async () =>
    JSON.stringify({ ...hostedReceipt, status, findings });

function withReviewOutcome(
  transport: Transport,
  lens: string,
  outcome: {
    status: string;
    evidence: string;
    findings: { id: string; evidence: string }[];
  },
): Transport {
  return async (args, timeout, env) => {
    const output = await transport(args, timeout, env);
    if (args[0] !== "logs") return output;
    const report = JSON.parse(
      output.replace("AX_REVIEW_BEGIN", "").replace("AX_REVIEW_END", ""),
    );
    if (report.outcomes[lens]) report.outcomes[lens] = outcome;
    return `AX_REVIEW_BEGIN${JSON.stringify(report)}AX_REVIEW_END`;
  };
}

function fallbackAssessment(
  state: Workflow,
  phase: "planning" | "implementation",
  role: "review-correctness" | "review-architecture" | "review-contract",
) {
  return {
    role,
    outcomes: Object.fromEntries(
      state.lenses[phase]
        .filter((lens) =>
          state.rounds[phase]?.lensAssignments[role].lensIds.includes(lens.id),
        )
        .map((lens) => [
          lens.id,
          {
            status: "passed" as const,
            evidence: `Owner inspected ${lens.id} against the exact target.`,
            findings: [],
          },
        ]),
    ),
  };
}

test("GREEN pi-paseo-workflow: deliberate focused handoff reaches Ready once without review loops", async () => {
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
  const reviewed = await f.read();
  for (const phase of ["planning", "implementation"] as const) {
    const round = reviewed.rounds[phase];
    assert.ok(round);
    const assigned = Object.values(round.lensAssignments).flatMap(
      (group) => group.lensIds,
    );
    assert.deepEqual(
      [...assigned].sort(),
      reviewed.lenses[phase].map((lens) => lens.id).sort(),
    );
    assert.ok(
      round.lensAssignments["review-architecture"].lensIds.includes(
        "code-simplifier",
      ),
    );
  }
  await writeFile(f.artifactPath, "Original edited after review and handoff.");
  const receipt = {
    ...hostedReceipt,
    evidence: "Finish inspected provider head and Ready state.",
  };
  await transition(f.path, "publication", receipt);
  const probed = await f.step(f.transport, probeReturning("completed"));
  assert.deepEqual(probed.recorded, ["hosted: completed"]);
  assert.equal(probed.result, "changed");
  assert.equal(probed.result === "changed" && probed.next.action, "finish");
  const finished = await transition(f.path, "finish", receipt);
  assert.equal(
    finished.finished,
    "Finish inspected provider head and Ready state.",
  );
  assert.deepEqual(
    finished.rounds.planning?.artifact,
    reviewed.rounds.planning?.artifact,
  );
  assert.deepEqual(
    finished.rounds.implementation?.artifact,
    reviewed.rounds.implementation?.artifact,
  );
  assert.deepEqual(finished.handoff?.brief, reviewed.handoff?.brief);
  assert.equal((await f.read()).finished, receipt.evidence);
  assert.equal(f.calls.filter((args) => args[0] === "run").length, 7);
  assert.equal(new Set(f.sessions.keys()).size, 7);
  assert.ok(
    f.calls
      .filter((args) => args[0] === "run")
      .every((args) => !args.includes("--output-schema")),
  );
  assert.equal((await f.step()).result, "finished");
  assert.equal(f.heartbeats.size, 0);
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

test("GREEN pi-paseo-workflow: no hosted gates publishes without a fabricated reviewer", async () => {
  const f = await fixture({ ci: "not-required", reviewer: "not-required" });
  await f.review("planning");
  await handoff(
    f.path,
    { briefPath: f.artifactPath, planResolution: "Settled." },
    f.transport,
  );
  await f.review("implementation");
  const publication = {
    artifactUrl: "https://github.com/owner/repo/pull/2",
    head: heads.first,
    ready: true as const,
    evidence: "Observed open Ready PR at exact head.",
    policySourceFingerprint,
  };
  await assert.rejects(
    transition(f.path, "publication", publication),
    /exact target-base SHA/,
  );
  const published = await transition(f.path, "publication", {
    ...publication,
    targetBase,
  });
  assert.equal(published.publication?.reviewer, undefined);
  assert.equal(published.hosted?.status, "completed");
});

test("RED pi-paseo-workflow: unknown policy blocks handoff", async () => {
  const f = await fixture({ ci: "unknown", reviewer: "not-required" });
  await f.review("planning");
  await assert.rejects(
    handoff(
      f.path,
      { briefPath: f.artifactPath, planResolution: "Settled." },
      f.transport,
    ),
    /Resolved delivery policy/,
  );
  await assert.rejects(
    dispatchReview(
      f.path,
      { phase: "planning", artifactPath: f.artifactPath },
      f.transport,
    ),
    /already dispatched/,
  );
});

test("GREEN pi-paseo-workflow: authorized continuation preserves prior evidence", async () => {
  const f = await fixture();
  await f.review("planning");
  await handoff(
    f.path,
    { briefPath: f.artifactPath, planResolution: "Settled." },
    f.transport,
  );
  await f.review("implementation");
  const continuation = {
    batchId: "follow-up-1",
    authorizationSource: "User requested one follow-up implementation batch.",
    purpose: "Repair the current task only.",
    allowedPhases: ["implementation" as const],
    expectedHead: heads.first,
  };
  await transition(f.path, "continuation", continuation);
  await transition(f.path, "continuation", continuation);
  const state = await f.read();
  assert.equal(state.history?.length, 1);
  assert.equal(state.history?.[0].rounds.implementation?.head, heads.first);
  assert.equal(state.history?.[0].authorization, undefined);
  assert.equal(state.rounds.implementation, undefined);
  await assert.rejects(
    transition(f.path, "continuation", {
      ...continuation,
      allowedPhases: ["hosted"],
    }),
    /explicit bounded authorization/,
  );
  await assert.rejects(
    transition(f.path, "continuation", {
      batchId: "follow-up-2",
      authorizationSource: "User",
      purpose: "Retry",
      allowedPhases: ["implementation"],
      expectedHead: "stale",
    }),
    /Bookkeeping mismatch/,
  );
});

test("workspace binding rejects mismatches and ambiguity, and registers once", async () => {
  const wrong = await fixture();
  await assert.rejects(
    bindWorkspace(wrong.path, { workspaceId: "other" }, async () =>
      JSON.stringify([{ workspaceId: "other", cwd: "/other" }]),
    ),
    /does not match canonical cwd/,
  );
  const ambiguous = await fixture();
  await assert.rejects(
    bindWorkspace(ambiguous.path, {}, async () =>
      JSON.stringify([
        { workspaceId: "one", cwd: ambiguous.dir },
        { workspaceId: "two", cwd: ambiguous.dir },
      ]),
    ),
    /ambiguous Paseo workspaces/,
  );
  const registration = await fixture();
  let created = false;
  let createCalls = 0;
  let releaseCreation: () => void = () => {};
  let signalCreation: () => void = () => {};
  const creationStarted = new Promise<void>((resolve) => {
    signalCreation = resolve;
  });
  const creationReleased = new Promise<void>((resolve) => {
    releaseCreation = resolve;
  });
  const transport: Transport = async (args) => {
    if (args[0] === "workspace" && args[1] === "ls")
      return JSON.stringify(
        created ? [{ workspaceId: "registered", cwd: registration.dir }] : [],
      );
    assert.equal(args[1], "create");
    createCalls++;
    signalCreation();
    await creationReleased;
    created = true;
    return JSON.stringify({ workspaceId: "registered" });
  };
  const first = bindWorkspace(
    registration.path,
    { registerWorkspace: true, projectId: "project" },
    transport,
  );
  await creationStarted;
  const second = bindWorkspace(
    registration.path,
    { registerWorkspace: true, projectId: "project" },
    transport,
  );
  await assert.rejects(second, /registration is already reserved/);
  releaseCreation();
  const results = await Promise.allSettled([first]);
  assert.equal(createCalls, 1);
  assert.equal(
    results.filter((result) => result.status === "fulfilled").length,
    1,
  );
  assert.equal((await registration.read()).workspace?.id, "registered");

  const uncertain = await fixture();
  let listCalls = 0;
  await assert.rejects(
    bindWorkspace(uncertain.path, { registerWorkspace: true }, async (args) => {
      if (args[1] === "create") throw new Error("lost create response");
      listCalls++;
      if (listCalls === 1) return "[]";
      throw new Error("workspace inspection unavailable");
    }),
    /workspace inspection unavailable/,
  );
  assert.equal(
    (await uncertain.read()).workspaceRegistration?.status,
    "uncertain",
  );
});

test("legacy mixed-model workflow state remains inspectable but cannot continue", async () => {
  const f = await fixture();
  const legacy = await f.read();
  delete legacy.reviewMode;
  await writeFile(f.path, JSON.stringify(legacy));
  assert.equal(
    (JSON.parse(await readFile(f.path, "utf8")) as Workflow).version,
    1,
  );
  await assert.rejects(
    transition(f.path, "policy", {
      deliveryPolicy: legacy.deliveryPolicy,
    }),
    /Legacy workflow state is read-only/,
  );
});

async function captureStdout(run: () => Promise<void>) {
  const write = process.stdout.write;
  let output = "";
  process.stdout.write = ((chunk: string) => {
    output += chunk;
    return true;
  }) as typeof process.stdout.write;
  try {
    await run();
  } finally {
    process.stdout.write = write;
  }
  return output;
}

test("GREEN pi-paseo-workflow: pre-orchestration state stays readable while tick is the only orchestrated advancement path", async () => {
  const f = await fixture();
  await dispatchReview(
    f.path,
    { phase: "planning", artifactPath: f.artifactPath },
    f.transport,
  );
  await assert.rejects(
    collectReviews(f.path, { phase: "planning" }, f.transport),
    /only through tick/,
  );
  const legacy = await f.read();
  delete legacy.orchestration;
  await writeFile(f.path, JSON.stringify(legacy));
  const status = await captureStdout(() =>
    main([f.path, "status"], { AX_PI_CONTRACT: '{"role":"implementer"}' }),
  );
  assert.equal(
    JSON.parse(status).rounds.planning.fingerprint,
    legacy.rounds.planning?.fingerprint,
  );
  await assert.rejects(f.step(), /predates planner orchestration/);
  await assert.rejects(
    handoff(
      f.path,
      { briefPath: f.artifactPath, planResolution: "Settled." },
      f.transport,
    ),
    /predates planner orchestration/,
  );
  await collectReviews(f.path, { phase: "planning" }, f.transport);
  assert.ok(
    Object.values((await f.read()).rounds.planning?.reviews ?? {}).every(
      (review) => review.status === "complete",
    ),
  );

  const g = await fixture({ ci: "required", reviewer: "not-required" });
  await g.review("planning");
  await g.accept();
  await g.review("implementation");
  await transition(g.path, "publication", {
    ...hostedReceipt,
    reviewer: undefined,
  });
  await assert.rejects(
    monitor(g.path, { probeCommand: ["finish-probe"] }),
    /only through tick/,
  );
});

test("RED pi-paseo-workflow: repeated phase cannot dispatch another review", async () => {
  const f = await fixture();
  const originalArtifact = await readFile(f.artifactPath, "utf8");
  await dispatchReview(
    f.path,
    { phase: "planning", artifactPath: f.artifactPath },
    f.transport,
  );
  const reserved = (await f.read()).rounds.planning?.artifact;
  assert.ok(reserved);
  await writeFile(
    f.artifactPath,
    "A different artifact cannot replace the reserved review.",
  );
  await assert.rejects(
    dispatchReview(
      f.path,
      { phase: "planning", artifactPath: f.artifactPath },
      f.transport,
    ),
    /already dispatched; no automatic reruns/,
  );
  assert.deepEqual((await f.read()).rounds.planning?.artifact, reserved);
  assert.equal(await readFile(reserved.path, "utf8"), originalArtifact);
  assert.equal(f.calls.filter((args) => args[0] === "run").length, 3);
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
  assert.equal(f.calls.filter((args) => args[0] === "run").length, 3);
  assert.ok(
    Object.values((await f.read()).rounds.planning?.reviews ?? {}).every(
      (review) => review.status === "running",
    ),
  );
});

test("reviewer launch and response failures become degraded evidence without retry", async () => {
  const f = await fixture();
  await dispatchReview(
    f.path,
    { phase: "planning", artifactPath: f.artifactPath },
    async (args, timeout, env) => {
      if (args[0] === "run") throw new Error("lost response");
      return f.transport(args, timeout, env);
    },
  );
  assert.ok(
    Object.values((await f.read()).rounds.planning?.reviews ?? {}).every(
      (review) => review.status === "degraded",
    ),
  );
  const degraded = await f.read();
  await transition(f.path, "triage", {
    phase: "planning",
    decisions: [],
    assessments: [
      fallbackAssessment(degraded, "planning", "review-correctness"),
      fallbackAssessment(degraded, "planning", "review-architecture"),
      fallbackAssessment(degraded, "planning", "review-contract"),
    ],
  });
  await handoff(
    f.path,
    { briefPath: f.artifactPath, planResolution: "Fallback review complete." },
    f.transport,
  );
  assert.equal(f.calls.filter((args) => args[0] === "run").length, 1);

  const g = await fixture();
  await dispatchReview(
    g.path,
    { phase: "planning", artifactPath: g.artifactPath },
    g.transport,
  );
  await g.step(async (args, timeout, env) =>
    args[0] === "logs" ? "" : g.transport(args, timeout, env),
  );
  assert.ok(
    Object.values((await g.read()).rounds.planning?.reviews ?? {}).every(
      (review) => review.status === "degraded",
    ),
  );
  await assert.rejects(
    handoff(
      g.path,
      { briefPath: g.artifactPath, planResolution: "No fallback assessment" },
      g.transport,
    ),
    /fallback assessment/,
  );
  const incomplete = fallbackAssessment(
    await g.read(),
    "planning",
    "review-correctness",
  );
  delete incomplete.outcomes["implementation-readiness"];
  await assert.rejects(
    transition(g.path, "triage", {
      phase: "planning",
      decisions: [],
      assessments: [incomplete],
    }),
    /complete per-lens owner fallback assessment/,
  );
});

test("scoped waivers preserve failed evidence, bind the current target, and do not widen authority", async () => {
  const f = await fixture();
  await dispatchReview(
    f.path,
    { phase: "planning", artifactPath: f.artifactPath },
    f.transport,
  );
  await f.step(
    withReviewOutcome(f.transport, "edge-cases-and-risk", {
      status: "blocked",
      evidence: "A material risk remains unresolved.",
      findings: [],
    }),
  );
  const state = await f.read();
  const target = state.rounds.planning?.fingerprint;
  assert.ok(target);
  const blocked = ["review-correctness:edge-cases-and-risk:blocked"];
  await transition(f.path, "triage", {
    phase: "planning",
    decisions: blocked.map((id) => ({
      id,
      action: "question",
      reason: "Only the user may accept this risk.",
    })),
  });
  await assert.rejects(
    transition(f.path, "waiver", {
      phase: "planning",
      target: "stale-target",
      requestedAction: "handoff",
      failedGates: blocked,
      reason: "Proceed despite the recorded blockers.",
    }),
    /target differs/,
  );
  await transition(f.path, "waiver", {
    phase: "planning",
    target,
    requestedAction: "handoff",
    failedGates: blocked,
    reason: "Proceed despite the recorded blockers.",
  });
  await assert.rejects(
    transition(f.path, "publication", {
      artifactUrl: "https://github.com/owner/repo/pull/1",
      head: target,
      reviewer: "genie",
      ready: true,
      evidence: "A handoff waiver cannot authorize publication.",
    }),
    /implementation review|publication|Review has not run/i,
  );
  await handoff(
    f.path,
    { briefPath: f.artifactPath, planResolution: "Blocked evidence waived." },
    f.transport,
  );
  const waived = await f.read();
  assert.deepEqual(waived.waivers?.[0]?.failedGates, blocked);
  assert.equal(
    waived.rounds.planning?.reviews["review-correctness"].outcomes?.[
      "edge-cases-and-risk"
    ].status,
    "blocked",
  );
});

test("uncertain implementer launch remains a hard blocker without retry", async () => {
  const f = await fixture();
  await f.review("planning");
  let attempts = 0;
  await assert.rejects(
    handoff(
      f.path,
      { briefPath: f.artifactPath, planResolution: "Planning is settled." },
      async (args, timeout, env) => {
        if (args[0] === "run") {
          attempts++;
          throw new Error("lost implementer launch response");
        }
        return f.transport(args, timeout, env);
      },
    ),
    /lost implementer launch response/,
  );
  assert.equal(attempts, 1);
  assert.equal((await f.read()).handoff?.status, "failed");
});

test("uncertain assignment release preserves the known identity and blocks retry", async () => {
  const f = await fixture();
  await f.review("planning");
  await assert.rejects(
    handoff(
      f.path,
      { briefPath: f.artifactPath, planResolution: "Planning is settled." },
      async (args, timeout, env) => {
        if (args[0] === "send") throw new Error("lost send response");
        return f.transport(args, timeout, env);
      },
    ),
    /lost send response/,
  );
  const failed = await f.read();
  assert.ok(failed.handoff?.agentId);
  assert.equal(failed.handoff?.launchStatus, "blocked");
  await assert.rejects(
    handoff(
      f.path,
      { briefPath: f.artifactPath, planResolution: "Do not resend." },
      f.transport,
    ),
    /already dispatched/,
  );
});

test("wrong-cwd inert launch never receives the task assignment", async () => {
  const f = await fixture();
  await f.review("planning");
  await assert.rejects(
    handoff(
      f.path,
      { briefPath: f.artifactPath, planResolution: "Planning is settled." },
      async (args, timeout, env) => {
        const output = await f.transport(args, timeout, env);
        return args[0] === "inspect"
          ? JSON.stringify({ ...JSON.parse(output), Cwd: "/wrong/worktree" })
          : output;
      },
    ),
    /Session cwd.*differs/,
  );
  const failed = await f.read();
  assert.equal(failed.handoff?.launchStatus, "blocked");
  assert.equal(
    f.calls.filter(
      (args) => args[0] === "send" && args[1] === failed.handoff?.agentId,
    ).length,
    0,
  );
});

test("authorized known-misroute recovery archives history and launches once", async () => {
  const f = await fixture();
  const gitEnv = {
    ...process.env,
    GIT_DIR: undefined,
    GIT_WORK_TREE: undefined,
    GIT_INDEX_FILE: undefined,
  };
  const git = (args: string[]) =>
    execFileSync("git", args, {
      cwd: f.dir,
      env: gitEnv,
      encoding: "utf8",
    });
  git(["init", "-b", "recovery"]);
  git(["config", "user.email", "fixture@example.test"]);
  git(["config", "user.name", "Fixture"]);
  git(["add", "."]);
  git(["commit", "-m", "fixture"]);
  await f.review("planning");
  await assert.rejects(
    handoff(
      f.path,
      { briefPath: f.artifactPath, planResolution: "Planning is settled." },
      async (args, timeout, env) => {
        const output = await f.transport(args, timeout, env);
        return args[0] === "inspect"
          ? JSON.stringify({ ...JSON.parse(output), Cwd: "/wrong/worktree" })
          : output;
      },
    ),
    /Session cwd.*differs/,
  );
  const failed = await f.read();
  const previousAgentId = failed.handoff?.agentId;
  assert.ok(previousAgentId);
  const head = git(["rev-parse", "HEAD"]).trim();
  const dirtyStatus = git(["status", "--porcelain=v1"])
    .trimEnd()
    .split("\n")
    .filter(Boolean);
  const input = {
    previousAgentId,
    authorizationSource:
      "User authorized retry of this exact no-write misroute.",
    branch: "recovery",
    head,
    dirtyStatus,
    noWritesEvidence:
      "The original session stopped after cwd verification and made no writes.",
  };
  const recoveryTransport: Transport = async (args, timeout, env) => {
    const output = await f.transport(args, timeout, env);
    return args[0] === "inspect" && args[args.length - 1] === previousAgentId
      ? JSON.stringify({ ...JSON.parse(output), Cwd: "/wrong/worktree" })
      : output;
  };
  const launchesBeforeRace = f.calls.filter((args) => args[0] === "run").length;
  await assert.rejects(
    retryMisroutedHandoff(f.path, input, async (args, timeout) => {
      const output = await recoveryTransport(args, timeout);
      if (args[0] === "inspect" && args[args.length - 1] === previousAgentId)
        await locked(f.path, (state) => {
          state.repairs.implementation = { status: "started" };
        });
      return output;
    }),
    /eligibility changed before recovery reservation/,
  );
  assert.equal(
    f.calls.filter((args) => args[0] === "run").length,
    launchesBeforeRace,
  );
  await locked(f.path, (state) => {
    delete state.repairs.implementation;
  });
  const recovered = await retryMisroutedHandoff(
    f.path,
    input,
    recoveryTransport,
  );
  assert.equal(recovered.handoffRecovery?.status, "complete");
  assert.notEqual(recovered.handoff?.agentId, previousAgentId);
  assert.equal(recovered.handoff?.launchStatus, "released");
  assert.equal(
    recovered.history?.at(-1)?.failedHandoff?.previousAgentId,
    previousAgentId,
  );
  assert.equal(
    recovered.rounds.planning?.fingerprint,
    failed.rounds.planning?.fingerprint,
  );
  const launches = f.calls.filter((args) => args[0] === "run").length;
  await retryMisroutedHandoff(f.path, input, recoveryTransport);
  assert.equal(f.calls.filter((args) => args[0] === "run").length, launches);
});

test("actual session model mismatch records degraded evidence", async () => {
  const f = await fixture();
  await dispatchReview(
    f.path,
    { phase: "planning", artifactPath: f.artifactPath },
    f.transport,
  );
  await f.step(async (args, timeout, env) => {
    const output = await f.transport(args, timeout, env);
    return args[0] === "inspect"
      ? JSON.stringify({ ...JSON.parse(output), Model: "other" })
      : output;
  });
  assert.ok(
    Object.values((await f.read()).rounds.planning?.reviews ?? {}).every(
      (review) => review.status === "degraded",
    ),
  );
});

test("review envelope accepts harmless surrounding prose", () => {
  const lenses = [
    { id: "diff-review", objective: "Inspect the exact implementation diff." },
  ];
  const envelope = `AX_REVIEW_BEGIN${JSON.stringify({ fingerprint: "target", outcomes: { "diff-review": { status: "passed", evidence: "Inspected the exact diff.", findings: [] } } })}AX_REVIEW_END`;

  assert.deepEqual(
    parseReview(
      `I completed the requested review after inspecting the immutable snapshots.\n\n${envelope}`,
      "target",
      lenses,
    ),
    {
      "diff-review": {
        status: "passed",
        evidence: "Inspected the exact diff.",
        findings: [],
      },
    },
  );
  assert.doesNotThrow(() =>
    parseReview(`${envelope}\n\nReview complete.`, "target", lenses),
  );
});

test("review envelope remains fail-closed for missing, ambiguous, malformed, and stale evidence", () => {
  const lenses = [
    { id: "diff-review", objective: "Inspect the exact implementation diff." },
  ];
  const envelope = `AX_REVIEW_BEGIN${JSON.stringify({ fingerprint: "target", outcomes: { "diff-review": { status: "passed", evidence: "Inspected the exact diff.", findings: [] } } })}AX_REVIEW_END`;

  assert.throws(
    () => parseReview("Review complete without an envelope.", "target", lenses),
    /Missing or ambiguous/,
  );
  assert.throws(
    () => parseReview(`${envelope}\n${envelope}`, "target", lenses),
    /Missing or ambiguous/,
  );
  assert.throws(
    () =>
      parseReview("AX_REVIEW_BEGIN{not-json}AX_REVIEW_END", "target", lenses),
    /JSON/,
  );
  assert.throws(
    () => parseReview(envelope, "new-target", lenses),
    /fingerprint mismatch/,
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
  await f.accept("No findings.");
  await f.review("implementation");
  await transition(f.path, "publication", hostedReceipt);
  await f.step(
    f.transport,
    probeReturning("completed", [
      { id: "finding-1", evidence: "Concrete defect." },
    ]),
  );
  await transition(f.path, "triage", {
    phase: "hosted",
    decisions: [{ id: "finding-1", action: "fix", reason: "Reproduced." }],
  });
  await f.repair("hosted", heads.second, "Unit regression passes.");
  await assert.rejects(
    dispatchRepair(
      f.path,
      { phase: "hosted", briefPath: f.repairBrief },
      f.transport,
    ),
    /Only one/,
  );
  await assert.rejects(
    transition(f.path, "finish", hostedReceipt),
    /head differs/,
  );
  await transition(f.path, "finish", {
    ...hostedReceipt,
    head: heads.second,
    evidence: "Second head observed Ready; hosted review only covered first.",
  });
  assert.equal((await f.read()).publication?.head, heads.second);
  await assert.rejects(
    dispatchRepair(
      f.path,
      { phase: "implementation", briefPath: f.repairBrief },
      f.transport,
    ),
    /already finished/,
  );
});

test("hosted ticks probe once each and expire without inferring success", async () => {
  const f = await fixture();
  await f.review("planning");
  await f.accept("No findings.");
  await f.review("implementation");
  await assert.rejects(
    transition(f.path, "publication", {
      ...hostedReceipt,
      probeCommand: undefined,
    }),
    /read-only probe argv/,
  );
  await transition(f.path, "publication", {
    ...hostedReceipt,
    deadlineMs: 60_000,
  });
  let probes = 0;
  const waiting: Transport = async () => {
    probes++;
    return JSON.stringify({
      ...hostedReceipt,
      status: "waiting",
      findings: [],
    });
  };
  for (let index = 0; index < 2; index++)
    assert.equal((await f.step(f.transport, waiting)).result, "unchanged");
  assert.equal(probes, 2);
  assert.equal(f.heartbeats.size, 1);
  const expired = await f.step(
    f.transport,
    waiting,
    () => Date.now() + 120_000,
  );
  assert.equal(probes, 2);
  assert.deepEqual(expired.recorded, ["hosted: timed-out"]);
  assert.equal(expired.result === "changed" && expired.next.action, "triage");
  assert.equal(f.heartbeats.size, 0);
  assert.equal((await f.read()).hosted?.status, "timed-out");
  await transition(f.path, "triage", {
    phase: "hosted",
    decisions: [
      {
        id: "hosted:timed-out",
        action: "question",
        reason: "The hosted deadline remains failed evidence.",
      },
    ],
  });
  assert.equal((await f.step()).result, "awaiting-user");
  await transition(f.path, "waiver", {
    phase: "hosted",
    target: heads.first,
    requestedAction: "finish",
    failedGates: ["hosted:timed-out"],
    reason: "Finish despite this exact timed-out hosted gate.",
  });
  const waived = await f.read();
  assert.equal(waived.hosted?.status, "timed-out");
  assert.doesNotThrow(() =>
    assertActionGateDisposition(waived, "hosted", "finish", heads.first),
  );
});

test("failed, awaiting-user, and waiting hosted evidence expose exact waivable gates without passing", async () => {
  for (const status of ["failed", "awaiting-user", "waiting"] as const) {
    const f = await fixture();
    await f.review("planning");
    await f.accept("No findings.");
    await f.review("implementation");
    await transition(f.path, "publication", hostedReceipt);
    if (status !== "waiting") {
      await f.step(f.transport, probeReturning(status));
    }
    const gate = `hosted:${status}`;
    await transition(f.path, "triage", {
      phase: "hosted",
      decisions: [
        {
          id: gate,
          action: "question",
          reason: "Preserve the unresolved hosted gate.",
        },
      ],
    });
    await transition(f.path, "waiver", {
      phase: "hosted",
      target: heads.first,
      requestedAction: "finish",
      failedGates: [gate],
      reason: "Finish despite this exact hosted gate.",
    });
    const waived = await f.read();
    assert.equal(waived.hosted?.status, status);
    assert.doesNotThrow(() =>
      assertActionGateDisposition(waived, "hosted", "finish", heads.first),
    );
  }
});

test("implementation questions block publication and applicable fixes consume one verified repair batch", async () => {
  const f = await fixture();
  await f.review("planning");
  await f.accept("No findings.");
  await dispatchReview(
    f.path,
    {
      phase: "implementation",
      artifactPath: f.artifactPath,
      head: heads.first,
    },
    f.transport,
  );
  await f.step(
    withReviewOutcome(f.transport, "code-simplifier", {
      status: "finding",
      evidence: "A duplicated branch can be removed without changing behavior.",
      findings: [
        {
          id: "duplicate-branch",
          evidence: "Both branches return the same value.",
        },
        {
          id: "extract-helper",
          evidence: "Consider extracting a helper.",
        },
      ],
    }),
  );
  const decisions = ["duplicate-branch", "extract-helper"].map((findingId) => ({
    id: `review-architecture:code-simplifier:${findingId}`,
    action: "question" as const,
    reason: "Need user decision on behavior boundary.",
  }));
  await transition(f.path, "triage", { phase: "implementation", decisions });
  const receipt = { ...hostedReceipt, evidence: "Observed Ready." };
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
  await assert.rejects(
    transition(f.path, "repair", { phase: "implementation", stage: "start" }),
    /fresh implementer dispatch/,
  );
  await f.repair("implementation", heads.repaired);
  await assert.rejects(
    dispatchRepair(
      f.path,
      { phase: "implementation", briefPath: f.repairBrief },
      f.transport,
    ),
    /Only one/,
  );
  await assert.rejects(
    transition(f.path, "publication", receipt),
    /head differs/,
  );
  await transition(f.path, "publication", { ...receipt, head: heads.repaired });
  assert.equal((await f.read()).publication?.head, heads.repaired);
});

test("terminal gate disposition rejects an A-to-B stale waiver and consumes an exact-current deployment waiver", async () => {
  const f = await fixture();
  await f.review("planning");
  f.reportHead(heads.headA);
  await f.accept("No planning findings.");
  await dispatchReview(
    f.path,
    {
      phase: "implementation",
      artifactPath: f.artifactPath,
      head: heads.headA,
    },
    f.transport,
  );
  await f.step(
    withReviewOutcome(f.transport, "diff-review", {
      status: "finding",
      evidence: "One repair and one user-owned risk decision remain.",
      findings: [
        { id: "repair", evidence: "The implementation needs a repair." },
        {
          id: "risk",
          evidence: "Deployment requires explicit risk acceptance.",
        },
      ],
    }),
  );
  const decisions = [
    {
      id: "review-correctness:diff-review:repair",
      action: "fix" as const,
      reason: "Repair in the one authorized batch.",
    },
    {
      id: "review-correctness:diff-review:risk",
      action: "question" as const,
      reason: "Only the user can accept this deployment risk.",
    },
  ];
  const riskGates = decisions
    .filter((decision) => decision.action === "question")
    .map((decision) => decision.id);
  const actionGates = decisions.map((decision) => decision.id);
  await transition(f.path, "triage", {
    phase: "implementation",
    decisions,
  });
  await transition(f.path, "waiver", {
    phase: "implementation",
    target: heads.headA,
    requestedAction: "deployment",
    failedGates: actionGates,
    reason: "Deploy head A despite the named repair and risk gates.",
  });
  const headA = await f.read();
  assert.doesNotThrow(() =>
    assertActionGateDisposition(
      headA,
      "implementation",
      "deployment",
      heads.headA,
    ),
  );
  await transition(f.path, "waiver", {
    phase: "implementation",
    target: heads.headA,
    requestedAction: "publication",
    failedGates: riskGates,
    reason: "Permit the one repair batch despite the user-owned risk gates.",
  });
  await f.repair(
    "implementation",
    heads.headB,
    "Focused behavior regression passes.",
  );
  const repaired = await f.read();
  assert.throws(
    () =>
      assertActionGateDisposition(
        repaired,
        "implementation",
        "deployment",
        heads.headB,
      ),
    /user input/,
  );
  await transition(f.path, "waiver", {
    phase: "implementation",
    target: heads.headB,
    requestedAction: "deployment",
    failedGates: actionGates,
    reason: "Deploy repaired head B despite the same named gates.",
  });
  const waived = await f.read();
  assert.doesNotThrow(() =>
    assertActionGateDisposition(
      waived,
      "implementation",
      "deployment",
      heads.headB,
    ),
  );
});

test("large plan, implementation and handoff use private snapshots with bounded argv", async () => {
  const f = await fixture();
  const large = "Source evidence.\n".repeat(20_000);
  assert.ok(Buffer.byteLength(large) > 200 * 1024);
  const transport: Transport = async (args, timeout, env) => {
    if (args[0] === "run") {
      assert.ok(Buffer.byteLength(args.join("\0")) < 8 * 1024);
      assert.ok(!args.join("\0").includes(large));
      await writeFile(f.artifactPath, "Original changed after reservation.");
    }
    return f.transport(args, timeout, env);
  };
  const verify = async (
    snapshot: { path: string; sha256: string },
    content: string,
  ) => {
    assert.equal(await readFile(snapshot.path, "utf8"), content);
    assert.equal(
      snapshot.sha256,
      createHash("sha256").update(content).digest("hex"),
    );
    assert.equal((await stat(snapshot.path)).mode & 0o777, 0o400);
    assert.equal((await stat(dirname(snapshot.path))).mode & 0o777, 0o700);
  };
  const review = async (phase: "planning" | "implementation") => {
    const content = `${phase}\n${large}`;
    await writeFile(f.artifactPath, content);
    await dispatchReview(
      f.path,
      { phase, artifactPath: f.artifactPath, head: heads.first },
      transport,
    );
    const round = (await f.read()).rounds[phase];
    assert.ok(round);
    await verify(round.artifact, content);
    await verify(round.lenses, JSON.stringify((await f.read()).lenses[phase]));
    await f.step(transport);
    await transition(f.path, "triage", { phase, decisions: [] });
  };
  await review("planning");
  const brief = `Accepted implementation brief\n${large}`;
  const planResolution = `Plan decisions\n${large}`;
  await writeFile(f.artifactPath, brief);
  await handoff(
    f.path,
    { briefPath: f.artifactPath, planResolution },
    transport,
  );
  const handed = (await f.read()).handoff;
  assert.ok(handed);
  await verify(handed.brief, brief);
  await verify(handed.planResolution, planResolution);
  await f.step(transport);
  await review("implementation");
  assert.equal(f.calls.filter((args) => args[0] === "run").length, 7);
  await assert.rejects(
    handoff(f.path, { briefPath: f.artifactPath, planResolution }, transport),
    /already dispatched/,
  );
});

const runs = (f: { calls: string[][] }) =>
  f.calls.filter((args) => args[0] === "run").length;

test("GREEN pi-paseo-workflow: ticks carry an unattended run from implementation report to triage", async () => {
  const f = await fixture();
  await f.review("planning");
  await handoff(
    f.path,
    { briefPath: f.artifactPath, planResolution: "Settled." },
    f.transport,
  );
  const armed = await syncHeartbeat(f.path, orchestrator, f.transport);
  assert.ok(armed);
  const reported = await f.step();
  assert.deepEqual(reported.recorded, [`handoff: complete at ${heads.first}`]);
  assert.equal(reported.result, "changed");
  assert.equal(reported.result === "changed" && reported.next.action, "review");
  assert.equal(reported.heartbeat, undefined);
  assert.ok((await f.read()).handoff?.report);
  await dispatchReview(
    f.path,
    {
      phase: "implementation",
      artifactPath: f.artifactPath,
      head: heads.first,
    },
    f.transport,
  );
  await syncHeartbeat(f.path, orchestrator, f.transport);
  const launches = runs(f);
  const reviewed = await f.step();
  assert.equal(reviewed.recorded.length, 3);
  assert.equal(reviewed.result === "changed" && reviewed.next.action, "triage");
  assert.equal(runs(f), launches);
  assert.equal(f.heartbeats.size, 0);
});

test("GREEN pi-paseo-workflow: a tick with busy workers is quiet and never dispatches", async () => {
  const f = await fixture();
  await dispatchReview(
    f.path,
    { phase: "planning", artifactPath: f.artifactPath },
    f.transport,
  );
  for (const session of f.sessions.values()) session.status = "running";
  const launches = runs(f);
  const quiet = await f.step();
  assert.deepEqual(quiet, {
    result: "unchanged",
    inFlight: [
      "planning:review-correctness",
      "planning:review-architecture",
      "planning:review-contract",
    ],
    recorded: [],
    heartbeat: (await f.read()).heartbeat,
  });
  assert.equal(runs(f), launches);
  assert.match(
    tickPrompt(f.path, await f.read()),
    /When the result is `unchanged`, end the turn with no user-visible message/,
  );
});

test("GREEN pi-paseo-workflow: one caller heartbeat is armed, renewed, re-armed after expiry, and deleted when nothing is in flight", async () => {
  const f = await fixture();
  await f.review("planning");
  await handoff(
    f.path,
    { briefPath: f.artifactPath, planResolution: "Settled." },
    f.transport,
  );
  for (const session of f.sessions.values()) session.status = "running";
  const first = await syncHeartbeat(f.path, orchestrator, f.transport);
  assert.equal(first?.agentId, orchestrator.agentId);
  assert.equal([...f.heartbeats.values()][0].agentId, orchestrator.agentId);
  await Promise.all([f.step(), f.step(), f.step()]);
  assert.equal(f.heartbeats.size, 1);
  assert.equal(f.maxHeartbeats(), 1);
  assert.equal((await f.read()).heartbeat?.id, first?.id);

  const halfway = () => Date.now() + 13 * 60 * 60_000;
  const renewed = await syncHeartbeat(
    f.path,
    orchestrator,
    f.transport,
    halfway,
  );
  assert.ok(renewed && renewed.id !== first?.id);
  assert.ok(Date.parse(renewed.expiresAt) > Date.parse(first?.expiresAt ?? ""));
  assert.deepEqual([...f.heartbeats.keys()], [renewed.id]);

  const later = () => Date.now() + 38 * 60 * 60_000;
  await assert.rejects(
    syncHeartbeat(
      f.path,
      orchestrator,
      async (args, timeout, env) => {
        if (args[1] === "create") throw new Error("daemon unavailable");
        return f.transport(args, timeout, env);
      },
      later,
    ),
    /daemon unavailable/,
  );
  assert.equal((await f.read()).heartbeat?.id, renewed.id);
  assert.deepEqual([...f.heartbeats.keys()], [renewed.id]);

  assert.equal(loopStatus(await f.read(), later), "expired");
  f.heartbeats.clear();
  const rearmed = await f.step(f.transport, undefined, later);
  assert.equal(rearmed.result, "unchanged");
  assert.equal(f.heartbeats.size, 1);
  assert.equal(loopStatus(await f.read(), later), "armed");
  await assert.rejects(
    syncHeartbeat(f.path, {}, f.transport),
    /PASEO_AGENT_ID/,
  );
  await transition(f.path, "order", {
    op: "add",
    id: "visibility",
    constraint: "Keep the repository private.",
    authorizationSource: "User message in this task",
  });
  const refreshed = await syncHeartbeat(f.path, orchestrator, f.transport);
  assert.notEqual(refreshed?.id, rearmed.heartbeat?.id);
  assert.match(
    f.heartbeats.get(refreshed?.id ?? "")?.prompt ?? "",
    /Keep the repository private/,
  );
  assert.equal(f.heartbeats.size, 1);
  for (const session of f.sessions.values()) session.status = "idle";
  await f.step();
  assert.equal(f.heartbeats.size, 0);
  assert.equal((await f.read()).heartbeat, undefined);
  assert.equal(loopStatus(await f.read()), "idle");
});

test("RED pi-paseo-workflow: managed workers cannot run orchestrator actions", async () => {
  const f = await fixture();
  const input = join(f.dir, "review-input.json");
  await writeFile(
    input,
    JSON.stringify({ phase: "planning", artifactPath: f.artifactPath }),
  );
  for (const role of ["implementer", "review-correctness", "unknown"])
    await assert.rejects(
      main([f.path, "review", input], {
        AX_PI_CONTRACT: JSON.stringify({ role }),
        PASEO_AGENT_ID: "worker",
      }),
      /cannot run orchestrator actions/,
    );
  await assert.rejects(
    main([f.path, "tick"], {
      AX_PI_CONTRACT: "not json",
      PASEO_AGENT_ID: "worker",
    }),
    /cannot run orchestrator actions/,
  );
  assert.equal((await f.read()).rounds.planning, undefined);
  assert.equal(f.calls.length, 0);
  const status = await captureStdout(() =>
    main([f.path, "status"], {
      AX_PI_CONTRACT: JSON.stringify({ role: "implementer" }),
    }),
  );
  assert.equal(JSON.parse(status).orchestration, "planner-v1");
});

test("GREEN pi-paseo-workflow: assignments and tick prompts carry only the effective standing orders", async () => {
  const f = await fixture();
  const order = (input: Record<string, string>) =>
    transition(f.path, "order", {
      authorizationSource: "User message in this task",
      ...input,
    });
  await order({
    op: "add",
    id: "visibility",
    constraint: "Keep the repository private.",
  });
  await order({
    op: "add",
    id: "delivery",
    constraint: "Publish to the feature branch only.",
  });
  await assert.rejects(
    order({ op: "add", id: "visibility", constraint: "Duplicate." }),
    /Standing order changes/,
  );
  await dispatchReview(
    f.path,
    { phase: "planning", artifactPath: f.artifactPath },
    f.transport,
  );
  const planning = await f.read();
  const assignment = await readFile(
    planning.rounds.planning?.reviews["review-contract"].assignment?.path ?? "",
    "utf8",
  );
  assert.match(assignment, /- visibility: Keep the repository private\./);
  assert.match(assignment, /- delivery: Publish to the feature branch only\./);
  assert.match(
    tickPrompt(f.path, planning),
    /- visibility: Keep the repository private\./,
  );
  await f.step();
  await transition(f.path, "triage", { phase: "planning", decisions: [] });
  await order({
    op: "amend",
    id: "visibility",
    constraint: "Repository visibility may be public after review.",
  });
  await order({ op: "retire", id: "delivery" });
  await assert.rejects(
    order({ op: "retire", id: "delivery" }),
    /Standing order changes/,
  );
  await f.accept();
  const handed = await f.read();
  const brief = await readFile(handed.handoff?.assignment?.path ?? "", "utf8");
  assert.match(brief, /- visibility: Repository visibility may be public/);
  assert.doesNotMatch(brief, /Keep the repository private/);
  assert.doesNotMatch(brief, /feature branch only/);
  assert.doesNotMatch(tickPrompt(f.path, handed), /feature branch only/);
  assert.deepEqual(
    handed.standingOrders?.map((change) => `${change.op}:${change.id}`),
    ["add:visibility", "add:delivery", "amend:visibility", "retire:delivery"],
  );
});

test("GREEN pi-paseo-workflow: contract questions and hosted user gates return awaiting-user and delete the heartbeat", async () => {
  const f = await fixture();
  await dispatchReview(
    f.path,
    { phase: "planning", artifactPath: f.artifactPath },
    f.transport,
  );
  await f.step(
    withReviewOutcome(f.transport, "implementation-readiness", {
      status: "finding",
      evidence: "The plan leaves the dispatch owner undecided.",
      findings: [{ id: "owner", evidence: "Two owners are named." }],
    }),
  );
  await transition(f.path, "triage", {
    phase: "planning",
    decisions: [
      {
        id: "review-correctness:implementation-readiness:owner",
        action: "question",
        reason: "Changes the plan contract.",
      },
    ],
  });
  const gated = await f.step();
  assert.equal(gated.result, "awaiting-user");
  assert.match(
    gated.result === "awaiting-user" ? gated.gate : "",
    /planning findings/,
  );

  const g = await fixture();
  await g.review("planning");
  await g.accept();
  await g.review("implementation");
  await transition(g.path, "publication", hostedReceipt);
  await g.step(g.transport, probeReturning("waiting"));
  assert.equal(g.heartbeats.size, 1);
  const hosted = await g.step(g.transport, probeReturning("awaiting-user"));
  assert.equal(hosted.result, "awaiting-user");
  assert.equal(g.heartbeats.size, 0);
  assert.equal((await g.read()).heartbeat, undefined);
});

test("GREEN pi-paseo-workflow: a repair batch launches one new verified implementer session", async () => {
  const f = await fixture();
  await f.review("planning");
  await f.accept();
  await dispatchReview(
    f.path,
    {
      phase: "implementation",
      artifactPath: f.artifactPath,
      head: heads.first,
    },
    f.transport,
  );
  await f.step(
    withReviewOutcome(f.transport, "diff-review", {
      status: "finding",
      evidence: "A regression needs repair.",
      findings: [{ id: "regression", evidence: "The guard is inverted." }],
    }),
  );
  await transition(f.path, "triage", {
    phase: "implementation",
    decisions: [
      {
        id: "review-correctness:diff-review:regression",
        action: "fix",
        reason: "Reproduced.",
      },
    ],
  });
  const next = await f.step();
  assert.equal(next.result === "changed" && next.next.action, "repair");
  const before = await f.read();
  const launches = runs(f);
  await dispatchRepair(
    f.path,
    { phase: "implementation", briefPath: f.repairBrief },
    f.transport,
  );
  const repairing = await f.read();
  const session = repairing.repairs.implementation?.session;
  assert.equal(runs(f), launches + 1);
  assert.equal(session?.launchStatus, "released");
  assert.ok(session?.agentId);
  assert.notEqual(session.agentId, before.handoff?.agentId);
  assert.equal(
    f.calls.filter(
      (args) => args[0] === "send" && args[1] === before.handoff?.agentId,
    ).length,
    1,
  );
  assert.match(
    await readFile(session.assignment?.path ?? "", "utf8"),
    /repair brief snapshot[\s\S]*do not dispatch reviewers, start workers, push, publish, or merge/,
  );
  for (const assignment of [session.assignment, before.handoff?.assignment]) {
    const text = await readFile(assignment?.path ?? "", "utf8");
    assert.match(text, /one shell command per tool call/);
    assert.match(text, /never issue git mutations as parallel tool calls/);
    assert.match(text, /AX_REPORT_BEGIN[\s\S]*"head"[\s\S]*AX_REPORT_END/);
  }
  await assert.rejects(
    transition(f.path, "repair", {
      phase: "implementation",
      stage: "complete",
      head: heads.repaired,
      verification: "Focused regression passes.",
    }),
    /started batch/,
  );
  const reported = await f.step();
  assert.deepEqual(reported.recorded, [
    `implementation-repair: complete at ${heads.first}`,
  ]);
  assert.equal(reported.result === "changed" && reported.next.action, "repair");
});

test("RED pi-paseo-workflow: ticks never start another review round or repair batch and time out busy reviewers as degraded evidence", async () => {
  const f = await fixture();
  await dispatchReview(
    f.path,
    { phase: "planning", artifactPath: f.artifactPath },
    f.transport,
  );
  for (const session of f.sessions.values()) session.status = "running";
  const launches = runs(f);
  const timedOut = await f.step(
    f.transport,
    undefined,
    () => Date.now() + 601_000,
  );
  assert.equal(timedOut.recorded.length, 3);
  assert.equal(timedOut.result === "changed" && timedOut.next.action, "triage");
  assert.equal(runs(f), launches);
  assert.equal(f.calls.filter((args) => args[0] === "stop").length, 3);
  const degraded = await f.read();
  assert.ok(
    Object.values(degraded.rounds.planning?.reviews ?? {}).every(
      (review) =>
        review.status === "degraded" && /timeout/.test(review.error ?? ""),
    ),
  );
  await assert.rejects(
    handoff(
      f.path,
      { briefPath: f.artifactPath, planResolution: "No fallback." },
      f.transport,
    ),
    /fallback assessment/,
  );
  await f.step();
  assert.equal(runs(f), launches);
  await assert.rejects(
    dispatchReview(
      f.path,
      { phase: "planning", artifactPath: f.artifactPath },
      f.transport,
    ),
    /no automatic reruns/,
  );
});

test("RED pi-paseo-workflow: an idle worker that has not begun its assignment stays in flight", async () => {
  const f = await fixture();
  await dispatchReview(
    f.path,
    { phase: "planning", artifactPath: f.artifactPath },
    f.transport,
  );
  const queued: Transport = async (args, timeout, env) =>
    args[0] === "logs" ? startupReply : f.transport(args, timeout, env);
  const waiting = await f.step(queued);
  assert.equal(waiting.result, "unchanged");
  assert.deepEqual(waiting.recorded, []);
  assert.ok(
    Object.values((await f.read()).rounds.planning?.reviews ?? {}).every(
      (review) => review.status === "running",
    ),
  );
  assert.equal((await f.step()).recorded.length, 3);
});

test("RED pi-paseo-workflow: review and repair heads must match the implementer report", async () => {
  const f = await fixture();
  await f.review("planning");
  await f.accept();
  await assert.rejects(
    dispatchReview(
      f.path,
      {
        phase: "implementation",
        artifactPath: f.artifactPath,
        head: heads.other,
      },
      f.transport,
    ),
    /verified report head equals the reviewed head/,
  );
  await dispatchReview(
    f.path,
    {
      phase: "implementation",
      artifactPath: f.artifactPath,
      head: heads.first,
    },
    f.transport,
  );
  await f.step(
    withReviewOutcome(f.transport, "diff-review", {
      status: "finding",
      evidence: "A regression needs repair.",
      findings: [{ id: "regression", evidence: "The guard is inverted." }],
    }),
  );
  await transition(f.path, "triage", {
    phase: "implementation",
    decisions: [
      {
        id: "review-correctness:diff-review:regression",
        action: "fix",
        reason: "Reproduced.",
      },
    ],
  });
  f.reportHead(heads.repaired);
  await dispatchRepair(
    f.path,
    { phase: "implementation", briefPath: f.repairBrief },
    f.transport,
  );
  await f.step();
  const complete = (head: string) =>
    transition(f.path, "repair", {
      phase: "implementation",
      stage: "complete",
      head,
      verification: "Focused regression passes.",
    });
  await assert.rejects(
    complete(heads.unreported),
    /verified head from the repair report/,
  );
  await complete(heads.repaired);
  assert.equal((await f.read()).repairs.implementation?.head, heads.repaired);
});

test("GREEN pi-paseo-workflow: inspection errors degrade reviewers and keep implementers in flight", async () => {
  const f = await fixture();
  await dispatchReview(
    f.path,
    { phase: "planning", artifactPath: f.artifactPath },
    f.transport,
  );
  const unavailable: Transport = async (args, timeout, env) => {
    if (args[0] === "inspect") throw new Error("daemon unavailable");
    return f.transport(args, timeout, env);
  };
  const degraded = await f.step(unavailable);
  assert.equal(degraded.recorded.length, 3);
  assert.ok(
    Object.values((await f.read()).rounds.planning?.reviews ?? {}).every(
      (review) =>
        review.status === "degraded" &&
        /daemon unavailable/.test(review.error ?? ""),
    ),
  );

  const g = await fixture();
  await g.review("planning");
  await handoff(
    g.path,
    { briefPath: g.artifactPath, planResolution: "Settled." },
    g.transport,
  );
  const flaky = await g.step(async (args, timeout, env) => {
    if (args[0] === "inspect") throw new Error("daemon unavailable");
    return g.transport(args, timeout, env);
  });
  assert.equal(flaky.result, "unchanged");
  assert.match(
    flaky.recorded[0],
    /handoff: inspect failed: .*daemon unavailable/,
  );
  assert.equal((await g.read()).handoff?.status, "running");
  assert.equal(
    (await g.step()).recorded[0],
    `handoff: complete at ${heads.first}`,
  );
});

test("GREEN pi-paseo-workflow: runner actions print one compact line and status stays the full read", async () => {
  const f = await fixture();
  const env = {
    AX_PI_CONTRACT: JSON.stringify({ role: "planner" }),
    PASEO_AGENT_ID: orchestrator.agentId,
  };
  const orderInput = join(f.dir, "order.json");
  await writeFile(
    orderInput,
    JSON.stringify({
      op: "add",
      id: "visibility",
      constraint: "Keep the repository private.",
      authorizationSource: "User message in this task",
    }),
  );
  const ordered = await captureStdout(() =>
    main([f.path, "order", orderInput], env),
  );
  assert.equal(ordered.trimEnd().split("\n").length, 1);
  assert.deepEqual(JSON.parse(ordered), {
    action: "order",
    recorded: ["standingOrders"],
    ids: { order: "visibility" },
    result: "changed",
    next: { action: "review", detail: "Dispatch the planning review round" },
  });
  await dispatchReview(
    f.path,
    { phase: "planning", artifactPath: f.artifactPath },
    f.transport,
  );
  await f.step();
  const triageInput = join(f.dir, "triage.json");
  await writeFile(
    triageInput,
    JSON.stringify({ phase: "planning", decisions: [] }),
  );
  const triaged = await captureStdout(() =>
    main([f.path, "triage", triageInput], env),
  );
  assert.equal(triaged.trimEnd().split("\n").length, 1);
  assert.deepEqual(JSON.parse(triaged), {
    action: "triage",
    recorded: ["decisions", "assessments"],
    ids: {},
    result: "awaiting-user",
    gate: "Plan acceptance is required before implementation handoff",
  });
  assert.doesNotMatch(triaged, /code-simplifier|outcomes|lenses/);
  const ticked = await captureStdout(() => main([f.path, "tick"], env));
  assert.equal(JSON.parse(ticked).action, "tick");
  const status = JSON.parse(
    await captureStdout(() => main([f.path, "status"], env)),
  );
  assert.ok(status.lenses.planning.length > 0);
  assert.ok(status.rounds.planning.reviews["review-architecture"].outcomes);
});

test("RED pi-paseo-workflow: only the worktree-verified envelope head binds review, never a prose SHA", async () => {
  const f = await fixture();
  await f.review("planning");
  f.replyWith(
    `Started from ${heads.second}; committed ${heads.first}.\n${reportEnvelope(implementerReport(heads.first))}`,
  );
  await f.accept();
  assert.deepEqual((await f.read()).handoff?.report, {
    ...implementerReport(heads.first),
    uncommitted: [],
  });
  for (const head of [heads.second, heads.first.slice(0, 7)])
    await assert.rejects(
      dispatchReview(
        f.path,
        { phase: "implementation", artifactPath: f.artifactPath, head },
        f.transport,
      ),
      /verified report head equals the reviewed head/,
    );
  await dispatchReview(
    f.path,
    {
      phase: "implementation",
      artifactPath: f.artifactPath,
      head: heads.first,
    },
    f.transport,
  );
  assert.equal((await f.read()).rounds.implementation?.head, heads.first);
});

test("RED pi-paseo-workflow: missing, duplicate, malformed, or mismatched reports fail the session for the user", async () => {
  type Fixture = Awaited<ReturnType<typeof fixture>>;
  const valid = reportEnvelope(implementerReport(heads.first));
  const cases: [string, (f: Fixture) => void, RegExp][] = [
    [
      "missing",
      (f) => f.replyWith(`Committed ${heads.first}.`),
      /Missing or ambiguous final implementer report envelope/,
    ],
    [
      "duplicate",
      (f) => f.replyWith(`${valid}\n${valid}`),
      /Missing or ambiguous/,
    ],
    [
      "malformed",
      (f) => f.replyWith("AX_REPORT_BEGIN{not-json}AX_REPORT_END"),
      /JSON/,
    ],
    [
      "short head",
      (f) =>
        f.replyWith(reportEnvelope(implementerReport(heads.first.slice(0, 7)))),
      /Malformed implementer report/,
    ],
    [
      "head mismatch",
      (f) => {
        f.tree.head = heads.second;
      },
      /differs from worktree/,
    ],
    [
      "branch mismatch",
      (f) => {
        f.tree.branch = "main";
      },
      /differs from worktree/,
    ],
  ];
  for (const [name, arrange, error] of cases) {
    const f = await fixture();
    await f.review("planning");
    arrange(f);
    await handoff(
      f.path,
      { briefPath: f.artifactPath, planResolution: "Settled." },
      f.transport,
    );
    const failed = await f.step();
    assert.deepEqual(failed.recorded, ["handoff: failed"], name);
    assert.equal(failed.result, "awaiting-user", name);
    const state = await f.read();
    assert.equal(state.handoff?.report, undefined, name);
    assert.match(state.handoff?.error ?? "", error, name);
  }
});

test("GREEN pi-paseo-workflow: a matching report records uncommitted files as evidence", async () => {
  const f = await fixture();
  await f.review("planning");
  f.tree.uncommitted = [" M notes.md", "?? scratch.txt"];
  await f.accept();
  const handed = (await f.read()).handoff;
  assert.equal(handed?.status, "complete");
  assert.deepEqual(handed?.report?.uncommitted, [
    " M notes.md",
    "?? scratch.txt",
  ]);
});
