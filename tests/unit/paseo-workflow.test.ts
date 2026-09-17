// charter-contracts: pi-paseo-workflow
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtemp, readFile, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import test from "node:test";
import {
  assertActionGateDisposition,
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

function fallbackAssessment(
  state: Workflow,
  phase: "planning" | "implementation",
  role: "review-glm" | "review-deepseek" | "review-astra",
) {
  return {
    role,
    outcomes: Object.fromEntries(
      state.lenses[phase].map((lens) => [
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
  const reviewed = await f.read();
  await writeFile(f.artifactPath, "Original edited after review and handoff.");
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
    /already dispatched/,
  );
  assert.deepEqual((await f.read()).rounds.planning?.artifact, reserved);
  assert.equal(await readFile(reserved.path, "utf8"), originalArtifact);
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

test("reviewer launch and response failures become degraded evidence without retry", async () => {
  const f = await fixture();
  await dispatchReview(
    f.path,
    { phase: "planning", artifactPath: f.artifactPath },
    async () => {
      throw new Error("lost response");
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
      fallbackAssessment(degraded, "planning", "review-glm"),
      fallbackAssessment(degraded, "planning", "review-deepseek"),
    ],
  });
  await handoff(
    f.path,
    { briefPath: f.artifactPath, planResolution: "Fallback review complete." },
    f.transport,
  );
  assert.equal(f.calls.length, 1);

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
    "review-glm",
  );
  delete incomplete.outcomes["code-simplifier"];
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
  await collectReviews(f.path, { phase: "planning" }, async (args, timeout) => {
    const output = await f.transport(args, timeout);
    if (args[0] !== "logs") return output;
    const report = JSON.parse(
      output.replace("AX_REVIEW_BEGIN", "").replace("AX_REVIEW_END", ""),
    );
    report.outcomes["edge-cases-and-risk"] = {
      status: "blocked",
      evidence: "A material risk remains unresolved.",
      findings: [],
    };
    return `AX_REVIEW_BEGIN${JSON.stringify(report)}AX_REVIEW_END`;
  });
  const state = await f.read();
  const target = state.rounds.planning?.fingerprint;
  assert.ok(target);
  const blocked = ["review-glm", "review-deepseek"].map(
    (role) => `${role}:edge-cases-and-risk:blocked`,
  );
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
    waived.rounds.planning?.reviews["review-glm"].outcomes?.[
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
      async () => {
        attempts++;
        throw new Error("lost implementer launch response");
      },
    ),
    /lost implementer launch response/,
  );
  assert.equal(attempts, 1);
  assert.equal((await f.read()).handoff?.status, "failed");
});

test("actual session model mismatch records degraded evidence", async () => {
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
      (review) => review.status === "degraded",
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
  await transition(f.path, "waiver", {
    phase: "hosted",
    target: "first",
    requestedAction: "finish",
    failedGates: ["hosted:timed-out"],
    reason: "Finish despite this exact timed-out hosted gate.",
  });
  const waived = await f.read();
  assert.equal(waived.hosted?.status, "timed-out");
  assert.doesNotThrow(() =>
    assertActionGateDisposition(waived, "hosted", "finish", "first"),
  );
});

test("failed, awaiting-user, and missing hosted evidence expose exact waivable gates without passing", async () => {
  for (const status of ["failed", "awaiting-user", "missing"] as const) {
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
      reviewer: "genie" as const,
      ready: true as const,
      evidence: "Observed source.",
    };
    await transition(f.path, "publication", receipt);
    if (status !== "missing") {
      await monitor(f.path, { probeCommand: ["probe"] }, async () =>
        JSON.stringify({ ...receipt, status, findings: [] }),
      );
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
      target: "first",
      requestedAction: "finish",
      failedGates: [gate],
      reason: "Finish despite this exact hosted gate.",
    });
    const waived = await f.read();
    assert.equal(waived.hosted?.status ?? "missing", status);
    assert.doesNotThrow(() =>
      assertActionGateDisposition(waived, "hosted", "finish", "first"),
    );
  }
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

test("terminal gate disposition rejects an A-to-B stale waiver and consumes an exact-current deployment waiver", async () => {
  const f = await fixture();
  await f.review("planning");
  await handoff(
    f.path,
    { briefPath: f.artifactPath, planResolution: "No planning findings." },
    f.transport,
  );
  await dispatchReview(
    f.path,
    { phase: "implementation", artifactPath: f.artifactPath, head: "head-a" },
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
      report.outcomes["diff-review"] = {
        status: "finding",
        evidence: "One repair and one user-owned risk decision remain.",
        findings: [
          { id: "repair", evidence: "The implementation needs a repair." },
          {
            id: "risk",
            evidence: "Deployment requires explicit risk acceptance.",
          },
        ],
      };
      return `AX_REVIEW_BEGIN${JSON.stringify(report)}AX_REVIEW_END`;
    },
  );
  const roles = ["review-glm", "review-deepseek", "review-astra"];
  const decisions = roles.flatMap((role) => [
    {
      id: `${role}:diff-review:repair`,
      action: "fix" as const,
      reason: "Repair in the one authorized batch.",
    },
    {
      id: `${role}:diff-review:risk`,
      action: "question" as const,
      reason: "Only the user can accept this deployment risk.",
    },
  ]);
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
    target: "head-a",
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
      "head-a",
    ),
  );
  await transition(f.path, "waiver", {
    phase: "implementation",
    target: "head-a",
    requestedAction: "publication",
    failedGates: riskGates,
    reason: "Permit the one repair batch despite the user-owned risk gates.",
  });
  await transition(f.path, "repair", {
    phase: "implementation",
    stage: "start",
  });
  await transition(f.path, "repair", {
    phase: "implementation",
    stage: "complete",
    head: "head-b",
    verification: "Focused behavior regression passes.",
  });
  const repaired = await f.read();
  assert.throws(
    () =>
      assertActionGateDisposition(
        repaired,
        "implementation",
        "deployment",
        "head-b",
      ),
    /user input/,
  );
  await transition(f.path, "waiver", {
    phase: "implementation",
    target: "head-b",
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
      "head-b",
    ),
  );
});

test("large plan, implementation and handoff use private snapshots with bounded argv", async () => {
  const f = await fixture();
  const large = "Source evidence.\n".repeat(20_000);
  assert.ok(Buffer.byteLength(large) > 200 * 1024);
  const transport: Transport = async (args, timeout) => {
    if (args[0] === "run") {
      assert.ok(Buffer.byteLength(args.join("\0")) < 8 * 1024);
      assert.ok(!args.join("\0").includes(large));
      await writeFile(f.artifactPath, "Original changed after reservation.");
    }
    return f.transport(args, timeout);
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
      { phase, artifactPath: f.artifactPath, head: "first" },
      transport,
    );
    const round = (await f.read()).rounds[phase];
    assert.ok(round);
    await verify(round.artifact, content);
    await verify(round.lenses, JSON.stringify((await f.read()).lenses[phase]));
    await collectReviews(f.path, { phase }, transport);
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
  await review("implementation");
  assert.equal(f.calls.filter((args) => args[0] === "run").length, 6);
  await assert.rejects(
    handoff(f.path, { briefPath: f.artifactPath, planResolution }, transport),
    /already dispatched/,
  );
});
