import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const instructionFiles = [
  "AGENTS.md",
  "instructions/AGENTS.md",
  "rules/docs-and-specs.md",
  "rules/handoff-and-resume.md",
] as const;

for (const file of instructionFiles) {
  test(`${file} requires readable summaries for structured thread contracts`, () => {
    const text = readFileSync(file, "utf-8");

    assert.match(text, /Readable Summary/);
    assert.match(text, /YAML or JSON|YAML\/JSON/);
  });
}

for (const file of ["AGENTS.md", "instructions/AGENTS.md"] as const) {
  test(`${file} requires writing-skills review for agent behavior changes`, () => {
    const text = readFileSync(file, "utf-8");

    assert.match(text, /writing-skills/);
    assert.match(text, /shared skill, agent, instruction, or rule sources/);
  });
}

for (const file of ["AGENTS.md", "instructions/AGENTS.md"] as const) {
  test(`${file} defines the portable shared skill boundary`, () => {
    const text = readFileSync(file, "utf-8");

    assert.match(text, /Portable shared skills/);
    assert.match(text, /owning skill folder/);
    assert.match(text, /real package dependency/);
    assert.match(text, /runtime\.reusableScripts/);
    assert.match(text, /ax-cli/);
  });
}

for (const file of ["AGENTS.md", "instructions/AGENTS.md"] as const) {
  test(`${file} routes agent commits through ax commit`, () => {
    const text = readFileSync(file, "utf-8");

    assert.match(text, /ax commit/);
    assert.match(text, /local review gate/);
    assert.match(text, /instead of raw `git commit`/);
    assert.match(text, /user's manual terminal/);
  });
}

for (const file of ["AGENTS.md", "instructions/AGENTS.md"] as const) {
  test(`${file} defaults accepted implementation work to branch publication`, () => {
    const text = readFileSync(file, "utf-8");

    assert.match(text, /accepted implementation work/);
    assert.match(text, /committing/);
    assert.match(text, /pushing to the selected hosted-review remote/);
    assert.match(text, /creating or updating a\s+PR\/MR/);
    assert.match(text, /hosted-review workflow/);
    assert.match(
      text,
      /Do not install dependencies or run destructive commands/,
    );
  });
}

for (const file of [
  "AGENTS.md",
  "instructions/AGENTS.md",
  "skills/plan-orchestrator/SKILL.md",
] as const) {
  test(`${file} pins plan-orchestrator terminal states`, () => {
    const text = readFileSync(file, "utf-8");

    assert.match(text, /plan-orchestrator/);
    assert.match(text, /stack_ready/);
    assert.match(text, /delivery_blocked/);
    assert.match(text, /not terminal success/);
  });
}

test("shared rules define deliverable-only OpenSpec task shape", () => {
  const text = readFileSync("rules/docs-and-specs.md", "utf-8");

  assert.match(text, /OpenSpec Task Shape/);
  assert.match(text, /deliverable implementation areas/);
  assert.match(text, /task groups anywhere in the file/);
  assert.match(text, /proof subcheck/);
  assert.match(text, /not a separate OpenSpec task checkbox/);
  assert.match(text, /independent delivery unit/);
  assert.match(text, /needs_spec_redesign/);
  assert.match(text, /Do not silently rewrite `tasks\.md`/);
});

test("planning skills reject lifecycle-only OpenSpec task phases", () => {
  const planReadyText = readFileSync("skills/plan-ready/SKILL.md", "utf-8");

  assert.match(planReadyText, /documentation, testing/);
  assert.match(planReadyText, /validation/);
  assert.match(planReadyText, /blocked_readiness\.reason/);
  assert.match(planReadyText, /needs_spec_redesign/);
  assert.match(planReadyText, /proof subchecks/);
  assert.match(planReadyText, /not as\s+OpenSpec\s+task checkboxes/);

  for (const file of [
    "skills/openspec-tasks/SKILL.md",
    "skills/plan-review/SKILL.md",
    "skills/plan-unit-sequencer/SKILL.md",
  ] as const) {
    const text = readFileSync(file, "utf-8");

    assert.match(text, /documentation, testing/);
    assert.match(text, /validation/);
    assert.match(text, /anywhere|anywhere in the file/);
    assert.match(text, /proof subchecks/);
    assert.match(text, /not as\s+OpenSpec\s+task checkboxes/);
    assert.match(text, /needs_spec_redesign/);
  }

  const orchestratorText = readFileSync(
    "skills/plan-orchestrator/SKILL.md",
    "utf-8",
  );

  assert.match(orchestratorText, /lifecycle-only/i);
  assert.match(orchestratorText, /needs_spec_redesign/);
  assert.match(orchestratorText, /ask the user|how to proceed/);
  assert.match(orchestratorText, /silently rewriting/);
});

test("plan workflow agent prompts use delivery-unit MR contracts", () => {
  const promptFiles = [
    "skills/plan-unit-delivery/agents/openai.yaml",
    "skills/plan-unit-sequencer/agents/openai.yaml",
    "skills/plan-orchestrator/agents/openai.yaml",
  ] as const;
  const activeSkillFiles = [
    "skills/plan-unit-delivery/SKILL.md",
    "skills/plan-unit-sequencer/SKILL.md",
    "skills/plan-orchestrator/SKILL.md",
  ] as const;
  const stalePromptPatterns = [
    /selected_task_id/,
    /unit_task_delta_valid/,
    /selected task ID/i,
    /selected task base SHA/i,
    /OpenSpec task checkbox/i,
    /exactly one expected deliverable task/i,
    /each selected OpenSpec task/i,
    /each OpenSpec task delivered/i,
    /task-delta validation/i,
    /task-to-artifact evidence/i,
  ];
  const staleRuntimeSurfacePatterns = [
    /selected_task_id/,
    /unit_task_delta_valid/,
    /one implementation MR per OpenSpec task/i,
    /one MR per OpenSpec task/i,
    /each selected OpenSpec task/i,
    /each OpenSpec task delivered/i,
  ];

  for (const file of promptFiles) {
    const text = readFileSync(file, "utf-8");

    assert.match(text, /delivery unit/i);
    assert.match(text, /one separate stacked PR\/MR|one separate PR\/MR/i);
    for (const pattern of stalePromptPatterns) {
      assert.doesNotMatch(text, pattern);
    }
  }

  for (const file of activeSkillFiles) {
    const text = readFileSync(file, "utf-8");

    assert.match(text, /delivery unit/i);
    for (const pattern of staleRuntimeSurfacePatterns) {
      assert.doesNotMatch(text, pattern);
    }
  }

  const deliveryPrompt = readFileSync(
    "skills/plan-unit-delivery/agents/openai.yaml",
    "utf-8",
  );
  assert.match(deliveryPrompt, /delivery_unit_delta_valid/);
  assert.match(deliveryPrompt, /one commit per nested work item/i);
  assert.match(deliveryPrompt, /validate-task-delta.*--unit/);
});

test("implementation rules keep local workflow artifacts out of work-project repos", () => {
  const text = readFileSync(
    "rules/investigation-and-implementation.md",
    "utf-8",
  );

  assert.match(
    text,
    /local workflow artifacts into work-project\s+repositories/,
  );
  assert.match(text, /Do not stage or commit/);
  assert.match(text, /readiness reports/);
  assert.match(text, /reviewer reports/);
  assert.match(text, /delivery\s+ledgers/);
  assert.match(text, /screenshots/);
  assert.match(text, /private\s+plan-support storage/);
  assert.match(text, /Reusable AI repo workflow machinery/);
  assert.match(text, /regression fixtures/);
});

test("implementation rules define accepted implementation followthrough", () => {
  const text = readFileSync(
    "rules/investigation-and-implementation.md",
    "utf-8",
  );

  assert.match(text, /Accepted implementation work includes/);
  assert.match(text, /implement, fix,\s+build, apply a plan/);
  assert.match(text, /review-feedback changes/);
  assert.match(text, /planning review/);
  assert.match(text, /troubleshooting-only\s+findings/);
  assert.match(text, /commit on the feature branch/);
  assert.match(text, /push to the selected\s+hosted-review remote/);
  assert.match(text, /create or\s+update a PR\/MR/);
  assert.match(text, /Select the\s+hosted-review provider before pushing/);
  assert.match(text, /remote fans out to multiple\s+hosts/);
  assert.match(text, /inspect CI or\s+no-pipeline state/);
  assert.match(text, /ambiguous\s+hosted-review provider routing/);
});

for (const file of ["AGENTS.md", "instructions/AGENTS.md"] as const) {
  test(`${file} blocks committed local workflow artifacts while preserving AI repo fixtures`, () => {
    const text = readFileSync(file, "utf-8");

    assert.match(text, /Do not stage or commit local workflow artifacts/);
    assert.match(text, /work-project repositories/);
    assert.match(text, /reviewer scratch/);
    assert.match(text, /readiness reports/);
    assert.match(text, /reviewer reports/);
    assert.match(text, /delivery ledgers/);
    assert.match(text, /validation evidence/);
    assert.match(text, /private plan-support pointers/);
    assert.match(text, /private plan-support storage/);
    assert.match(text, /Reusable AI repo workflow machinery/);
    assert.match(text, /regression fixtures/);
    assert.match(text, /feature being changed in this AI repo/);
  });
}

test("git rules require stacked MRs to land bottom-to-top", () => {
  const text = readFileSync("rules/git-and-review.md", "utf-8");

  assert.match(text, /merge MRs in a stack/);
  assert.match(text, /bottom of the\s+stack to the top/);
  assert.match(text, /first\/base MR to `main` first/);
  assert.match(text, /last\/top MR is merged last/);
  assert.match(text, /retarget the next stacked MR to `main`/);
  assert.match(text, /resolve the conflict on that MR's source branch/);
});

test("git rules route host-neutral hosted review requests", () => {
  const text = readFileSync("rules/git-and-review.md", "utf-8");

  assert.match(text, /host-neutral work/);
  assert.match(text, /project\s+instructions/);
  assert.match(text, /existing artifact URLs/);
  assert.match(text, /change-request-create/);
  assert.match(text, /provider routing remains ambiguous/);
  assert.match(text, /Select the hosted-review provider before pushing/);
  assert.match(text, /multiple push URLs/);
  assert.match(text, /not to every configured mirror/);
});

test("ai repo delivery uses GitLab MRs with Nitro review by default", () => {
  const agentsText = readFileSync("AGENTS.md", "utf-8");
  const gitRulesText = readFileSync("rules/git-and-review.md", "utf-8");

  for (const text of [agentsText, gitRulesText]) {
    assert.match(text, /GitLab `origin`/);
    assert.match(
      text,
      /merge request.*targeting `main`|merge requests against `main`/,
    );
    assert.match(text, /\/request_review @nitro/);
    assert.match(text, /latest-head Nitro feedback/);
    assert.doesNotMatch(text, /commit directly on `main` after completing/);
    assert.doesNotMatch(text, /GitHub is the primary `main` publishing remote/);
    assert.doesNotMatch(text, /ordinary direct-publish guidance/);
  }
});

test("portable instructions keep hosted review routing project-specific", () => {
  const text = readFileSync("instructions/AGENTS.md", "utf-8");

  assert.match(text, /Project-specific instructions define/);
  assert.match(text, /hosted-review route/);
  assert.match(text, /Do not push default branches/);
  assert.match(text, /Fullscript GitLab merge requests/);
  assert.match(text, /do not request Nitro for GitHub PRs/);
  assert.match(text, /project-selected hosted-review route/);
  assert.doesNotMatch(text, /For this repo/);
  assert.doesNotMatch(text, /GitLab `origin`/);
  assert.doesNotMatch(text, /merge requests against `main`/);
});

test("Fullscript Nitro rules stay scoped to Fullscript GitLab MRs", () => {
  const text = readFileSync("rules/fullscript/nitro-review.md", "utf-8");

  assert.match(text, /Fullscript repositories/);
  assert.match(text, /GitLab MR/);
  assert.match(text, /After creating a GitLab MR/);
  assert.match(text, /After pushing a follow-up commit to a GitLab MR/);
  assert.match(text, /materially changed/);
  assert.match(text, /personal GitHub repositories/);
  assert.match(text, /Nitro is unavailable/);
});

for (const file of [
  "skills/plan-ready/SKILL.md",
  "skills/plan-ready/agents/openai.yaml",
] as const) {
  test(`${file} keeps readiness separate from orchestrator completion`, () => {
    const text = readFileSync(file, "utf-8");

    assert.match(text, /readiness is not terminal completion/i);
    assert.match(text, /stack_ready/);
    assert.match(text, /delivery_blocked/);
  });
}

for (const file of [
  "skills/plan-ready/SKILL.md",
  "skills/plan-ready/agents/openai.yaml",
] as const) {
  test(`${file} routes reviewer selection for task-shape and workflow-artifact blockers`, () => {
    const text = readFileSync(file, "utf-8");

    assert.match(text, /docs-and-agent-alignment/);
    assert.match(text, /ax-and-skill-compatibility/);
    assert.match(text, /local workflow artifact/i);
    assert.match(text, /lifecycle-only/);
    assert.match(text, /validation-only/);
    assert.match(text, /proof-only/);
    assert.match(text, /checkbox-only/);
  });
}

for (const file of [
  "skills/plan-ready/SKILL.md",
  "skills/plan-ready/agents/openai.yaml",
] as const) {
  test(`${file} makes baseline reviewer task-shape blockers non-optional`, () => {
    const text = readFileSync(file, "utf-8");

    assert.match(text, /baseline reviewer/i);
    assert.match(text, /blocking planning-readiness\s+findings/);
    assert.match(text, /final documentation or validation\s+phases/);
    assert.match(text, /checkbox-only delivery\s+units/);
    assert.match(text, /committed local workflow artifacts/);
    assert.match(text, /not optional suggestions|not suggestions/);
  });
}

for (const file of [
  "skills/plan-review/SKILL.md",
  "skills/plan-review/agents/openai.yaml",
] as const) {
  test(`${file} keeps planning review separate from orchestrator completion`, () => {
    const text = readFileSync(file, "utf-8");

    assert.match(text, /planning_review/);
    assert.match(text, /not terminal success/i);
    assert.match(text, /stack_ready/);
    assert.match(text, /delivery_blocked/);
  });
}

for (const file of [
  "skills/plan-ready/SKILL.md",
  "skills/plan-ready/agents/openai.yaml",
  "skills/plan-review/SKILL.md",
  "skills/plan-review/agents/openai.yaml",
  "skills/plan-orchestrator/SKILL.md",
  "skills/plan-orchestrator/agents/openai.yaml",
  "rules/investigation-and-implementation.md",
] as const) {
  test(`${file} keeps support artifacts out of committed plan sidecars`, () => {
    const text = readFileSync(file, "utf-8");

    assert.match(text, /\.agents\/plans/);
    assert.match(text, /support\s+(workflow\s+)?(artifacts|sidecars)/i);
    assert.match(text, /thread/);
    assert.match(
      text,
      /private\s+support\s+(storage|artifacts|copies)|thread evidence|pnpm ax plans artifact|private AX plan artifact/i,
    );
    if (file.startsWith("skills/")) {
      assert.doesNotMatch(
        text,
        /pnpm ax plans artifact|private AX plan artifact|~\/\.ax\/plans/i,
      );
    }
    assert.match(
      text,
      /Do not commit|must\s+not\s+be\s+committed|must be rejected/,
    );
  });
}

test("repo implementation rules distinguish primary atomic plan markdown from support sidecars", () => {
  const text = readFileSync(
    "rules/investigation-and-implementation.md",
    "utf-8",
  );

  assert.match(text, /primary\s+atomic\s+plan\s+markdown/i);
  assert.match(text, /valid reviewed planning artifact/i);
  assert.match(text, /support\s+sidecars/i);
  assert.match(
    text,
    /do not commit `.agents\/plans\/\*\*` support\s+sidecars/i,
  );
});

test("ax-cli skill documents private plan artifact record and list commands", () => {
  const text = readFileSync("skills/ax-cli/SKILL.md", "utf-8");

  assert.match(text, /Private Plan Support Artifacts/);
  assert.match(text, /ax plans artifact record/);
  assert.match(text, /ax plans artifact list/);
  assert.match(text, /\.agents\/plans\/example\.md/);
  assert.match(text, /review_request/);
  assert.match(text, /reviewer_selection/);
  assert.match(text, /validation_input/);
  assert.match(text, /validation_output/);
  assert.match(text, /invocation target repo/i);
  assert.match(text, /do not commit/i);
  assert.match(text, /do not expose local private workspace paths/i);
});

for (const file of [
  "skills/change-request-create/SKILL.md",
  "skills/glab-mr-create/SKILL.md",
  "skills/github-pr-create/SKILL.md",
  "rules/git-and-review.md",
] as const) {
  test(`${file} keeps hosted descriptions free of private plan artifact paths`, () => {
    const text = readFileSync(file, "utf-8");

    assert.match(
      text,
      /private support artifacts?|private plan-support paths/i,
    );
    if (file.startsWith("skills/")) {
      assert.doesNotMatch(text, /~\/\.ax\/plans|private AX plan artifact/i);
    }
    assert.match(text, /MR|PR|hosted|description/i);
    assert.match(text, /summaries/);
    assert.match(text, /hashes/);
    assert.match(text, /thread references/);
    assert.match(text, /note IDs/);
    assert.match(text, /discussion IDs/);
    assert.match(text, /stable\s+correlation IDs/);
  });
}

for (const file of [
  "skills/plan-review/SKILL.md",
  "skills/plan-unit-delivery/SKILL.md",
  "skills/plan-unit-sequencer/SKILL.md",
] as const) {
  test(`${file} separates local commit gates from hosted advancement gates`, () => {
    const text = readFileSync(file, "utf-8");

    assert.match(text, /local review gate/i);
    assert.match(text, /commit(?:-boundary| boundary|s?\b)/i);
    assert.match(text, /hosted/i);
    assert.match(text, /Nitro/i);
    assert.match(text, /stack advancement|implementation sequencing|advance/i);
    assert.match(text, /actionable feedback|actionable-feedback/i);
  });
}
