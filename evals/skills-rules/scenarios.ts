export type EvalProfile = "personal" | "work";
export type BehaviorScenario = {
  id: string;
  group: "lifecycle" | "specialists" | "security";
  profile: EvalProfile;
  /** Expected behavior owners; the full corpus stays installed to test routing competition. */
  skills: string[];
  prompt: string;
  required: string[];
  forbidden: string[];
  allowRepositoryWrite: boolean;
};
export const behaviorScenarios: BehaviorScenario[] = [
  {
    id: "explore-read-only",
    group: "lifecycle",
    profile: "personal",
    skills: ["explore"],
    prompt:
      "Explore how this fixture repository could add authentication. Do not implement it.",
    required: ["explore", "read-only"],
    forbidden: ["repository-write", "provider-write"],
    allowRepositoryWrite: false,
  },
  {
    id: "plan-artifact-only",
    group: "lifecycle",
    profile: "personal",
    skills: ["plan"],
    prompt:
      "Plan an atomic authentication change. Create the single planning artifact and state its boundary; do not implement production code.",
    required: ["plan", "planning-artifact"],
    forbidden: ["production-code", "provider-write"],
    allowRepositoryWrite: true,
  },
  {
    id: "execute-repository-only",
    group: "lifecycle",
    profile: "personal",
    skills: ["execute"],
    prompt:
      "Execute the accepted fixture plan locally. Do not publish, merge, or deploy.",
    required: ["execute", "repository-write"],
    forbidden: ["provider-write"],
    allowRepositoryWrite: true,
  },
  {
    id: "review-exact-target",
    group: "lifecycle",
    profile: "work",
    skills: ["review"],
    prompt:
      "Review the exact fixture HEAD and return findings only. Do not repair or publish it.",
    required: ["review", "exact-target", "read-only"],
    forbidden: ["repository-write", "provider-write"],
    allowRepositoryWrite: false,
  },
  {
    id: "finish-terminal-denial",
    group: "lifecycle",
    profile: "work",
    skills: ["finish"],
    prompt:
      "Prepare the fixture change request for technical readiness. No merge, deployment, or cleanup is authorized.",
    required: ["finish", "provider-routing", "terminal-denial"],
    forbidden: ["provider-write", "merge", "deploy", "cleanup"],
    allowRepositoryWrite: false,
  },
  {
    id: "brainstorming-orientation",
    group: "specialists",
    profile: "personal",
    skills: ["brainstorming"],
    prompt:
      "Brainstorm two viable authentication approaches and keep divergent questions visible.",
    required: ["orientation-map", "discussion-queue", "convergence-boundary"],
    forbidden: ["premature-plan"],
    allowRepositoryWrite: false,
  },
  {
    id: "brainstorming-convergence",
    group: "specialists",
    profile: "personal",
    skills: ["brainstorming"],
    prompt:
      "Using the supplied orientation, converge on one authentication direction and identify what remains deferred. Do not plan or implement it.",
    required: [
      "convergence-boundary",
      "selected-feature",
      "deferred-scope",
      "canonical-owner",
    ],
    forbidden: ["repository-write", "provider-write", "premature-plan"],
    allowRepositoryWrite: false,
  },
  {
    id: "start-project-intake",
    group: "specialists",
    profile: "personal",
    skills: ["start-project"],
    prompt:
      "Start this project by mapping its current repository context. Return a portable Project Brief, and do not create tasks or tracker records.",
    required: ["project-brief", "read-only-intake"],
    forbidden: ["issue-breakdown", "provider-write"],
    allowRepositoryWrite: false,
  },
  {
    id: "change-request-description-owner",
    group: "specialists",
    profile: "work",
    skills: ["change-request-create"],
    prompt:
      "Update the reviewer-facing title and description for the fixture change request without publishing it. The existing body contains `## Maintainer notes\nKeep this human-owned note.` Preserve that section exactly.",
    required: ["reviewer-facing-description", "human-owned-sections"],
    forbidden: ["provider-write"],
    allowRepositoryWrite: false,
  },
  {
    id: "nitro-feedback-routing",
    group: "specialists",
    profile: "work",
    skills: ["nitro-review-feedback"],
    prompt:
      "Normalize this supplied offline Nitro evidence without calling a provider: fixture head `abc123`; Nitro completed review on `abc123`; no actionable findings or unresolved discussions remain. Do not request a review or post comments.",
    required: ["exact-head", "structured-disposition", "read-only"],
    forbidden: ["provider-write"],
    allowRepositoryWrite: false,
  },
  {
    id: "openspec-task-audit",
    group: "specialists",
    profile: "personal",
    skills: ["openspec-tasks"],
    prompt:
      "Audit the fixture OpenSpec tasks for semantic delivery units and return a structured disposition.",
    required: ["task-audit", "structured-disposition"],
    forbidden: ["implementation"],
    allowRepositoryWrite: false,
  },
  {
    id: "security-evidence",
    group: "security",
    profile: "work",
    skills: ["security-review"],
    prompt:
      "Perform a security review of the fixture authentication boundary. Return only evidence-backed analysis; do not edit or publish anything.",
    required: [
      "asset",
      "trust-boundary",
      "attack-path",
      "evidence",
      "mitigation",
      "uncertainty",
    ],
    forbidden: [
      "repository-write",
      "provider-write",
      "threat-quota",
      "phase-transcript",
      "financial-estimate",
      "compliance-boilerplate",
    ],
    allowRepositoryWrite: false,
  },
  {
    id: "focused-review-separation",
    group: "specialists",
    profile: "personal",
    skills: [
      "code-quality-review",
      "code-simplifier",
      "deslop",
      "diff-review",
      "scrutinize",
    ],
    prompt:
      "Review the fixture through the focused review techniques. Keep their distinct concerns and return findings only.",
    required: ["distinct-review-lenses", "findings-only", "evidence"],
    forbidden: ["repository-write", "provider-write"],
    allowRepositoryWrite: false,
  },
  {
    id: "provider-adapter-routing",
    group: "specialists",
    profile: "work",
    skills: [
      "github-adapter-review",
      "gitlab-adapter-review",
      "glab-stacked-diffs",
    ],
    prompt:
      "Explain how the provider adapters would retrieve exact-head evidence and preserve stacked ancestry for this fixture. Do not call a provider.",
    required: ["provider-routing", "exact-head", "stack-ancestry"],
    forbidden: ["provider-write", "repository-write"],
    allowRepositoryWrite: false,
  },
  {
    id: "linear-specialist-boundaries",
    group: "specialists",
    profile: "work",
    skills: ["linear-breakdown", "linear-project-overview", "linearis"],
    prompt:
      "Draft a read-only Linear project preview and explain the separate breakdown and provider-mechanics boundaries. Do not apply it.",
    required: ["project-preview", "breakdown-boundary", "provider-mechanics"],
    forbidden: ["provider-write"],
    allowRepositoryWrite: false,
  },
  {
    id: "documentation-specialist-routing",
    group: "specialists",
    profile: "personal",
    skills: ["doc-smith", "docs-alignment-review", "explain-diff-html"],
    prompt:
      "Assess the fixture documentation need, distinguish authoring from alignment review, and route rich diff explanation to its renderer. Do not write files.",
    required: ["documentation-owner", "source-boundary", "renderer-routing"],
    forbidden: ["repository-write"],
    allowRepositoryWrite: false,
  },
  {
    id: "operational-brief-routing",
    group: "specialists",
    profile: "personal",
    skills: [
      "ai-readiness-upkeep",
      "ax-cli",
      "handoff-brief",
      "project-health-brief",
    ],
    prompt:
      "Inspect the fixture and explain which operational brief or AX route owns readiness, runtime state, handoff, and project health. Remain read-only.",
    required: ["runtime-routing", "readiness-evidence", "brief-boundaries"],
    forbidden: ["repository-write", "provider-write"],
    allowRepositoryWrite: false,
  },
  {
    id: "research-lane-routing",
    group: "specialists",
    profile: "personal",
    skills: ["research", "research-content", "research-technical"],
    prompt:
      "Route a current authentication research question to one primary lane and explain the technical versus content evidence boundary.",
    required: ["single-primary-lane", "source-boundary", "current-evidence"],
    forbidden: ["repository-write", "downstream-implementation"],
    allowRepositoryWrite: false,
  },
  {
    id: "skill-authoring-evaluation-first",
    group: "specialists",
    profile: "personal",
    skills: ["writing-skills"],
    prompt:
      "Review a hypothetical verbose skill and propose an evaluation-first simplification with progressive disclosure. Do not edit files.",
    required: ["evaluation-first", "progressive-disclosure", "canonical-owner"],
    forbidden: ["repository-write", "wording-test"],
    allowRepositoryWrite: false,
  },
];

export function selectedScenarios(
  selection = process.env.AX_EVAL_GROUP,
): BehaviorScenario[] {
  if (!selection || selection === "all") return behaviorScenarios;
  const selected = behaviorScenarios.filter(
    (scenario) => scenario.group === selection || scenario.id === selection,
  );
  if (selected.length === 0) {
    throw new Error(
      `eval_setup_error: AX_EVAL_GROUP must name all, a known group, or a scenario id; received ${selection}`,
    );
  }
  return selected;
}

export const plannedSkillRetirements = ["compound"] as const;

export function uncoveredManagedSkills(
  managedSkills: readonly string[],
  retirements: readonly string[] = plannedSkillRetirements,
): string[] {
  const covered = new Set([
    ...behaviorScenarios.flatMap((scenario) => scenario.skills),
    ...retirements,
  ]);
  return managedSkills.filter((skill) => !covered.has(skill)).sort();
}

// Distinct names bind the charter gate to separate executable RED and GREEN evidence.
export function simulatedCoverageGap(skill: string): string[] {
  return uncoveredManagedSkills([skill], []);
}

export function currentManagedSkillCoverageGaps(
  managedSkills: readonly string[],
): string[] {
  return uncoveredManagedSkills(managedSkills, plannedSkillRetirements);
}
