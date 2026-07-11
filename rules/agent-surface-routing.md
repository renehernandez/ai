# Agent Surface Routing Rules

Use these rules when deciding which instructions and context are available to an agent session across local apps, CLIs, IDEs, browser clients, cloud workers, and CI automation.

## Execution Surfaces

- Treat desktop apps, local CLIs, IDE extensions, and remote control of a local desktop host as local agent surfaces.
- Treat web apps, delegated cloud tasks, hosted PR review, and hosted security review as cloud agent surfaces.
- Treat GitHub Actions, GitLab CI, private runners, and scheduled jobs as CI automation, even when they invoke an agent or model.

## Local Agent Surfaces

Local agent surfaces can use the local machine's workspace state, repository checkout, shell, configured plugins, skills, hooks, approvals, and user-level `~/.agents` instructions.

When a remote client is controlling a local desktop host, assume the underlying host remains the source of project files, shell state, terminal output, diffs, test results, approvals, and local context. For Codex, this includes ChatGPT remote control of Codex Desktop. If the host is offline, asleep, disconnected, or remote control is disabled, do not assume this local context is available.

For local VialMate work, start from the actual worktree and GitHub state before acting. Do not substitute a cloud repository view for local state unless the user explicitly asks for cloud-only work.

## Cloud Agent Surfaces

Cloud agent surfaces should not be assumed to see user-level local files such as `~/.agents`, local-only skills, local hooks, uncommitted worktree state, or machine-specific memory.

For work that must run well in hosted agents, cloud PR review, background PR review, or cloud security review, put durable guidance in repo-visible files such as `AGENTS.md`, `.agents/rules/*`, or `docs/*`.

Use repo-visible instructions for background-agent PR review rubrics, security expectations, dependency policies, project taxonomy, and testing terminology. Start from the shared template at `templates/background-agent-pr-review-rubric.md` in the AI repo when a project does not already define a rubric.

## Choosing The Source Of Truth

- For local implementation, prefer the local checkout plus `~/.agents` and project `AGENTS.md`.
- For cloud or background PR review, prefer repo-visible instructions and the PR diff.
- For questions about existing local work, prefer desktop/session state and the local worktree.
- For questions about merged code, PRs/MRs, CI, and remote branches, verify with
  the project-selected provider.

If a conclusion depends on a surface-specific capability, name the surface in the answer. For example, say "the local desktop agent can use the local skill" or "the background reviewer needs this in repo-visible docs".

## Organizational agent routing

Codex remains the local user interface. After activation, one Cloudflare
Durable Object holds authoritative organizational state and local one-shot Flue
runs execute queued work. Linear receives durable memory and result projections;
Git and GitLab remain canonical for delivery artifacts.

- Route software-portfolio requests through the Delivery Executive Assistant.
- Route calendar, email, Slack, and follow-up drafting through the Executive
  Operations Assistant.
- Use one Linear Project Manager per Linear Project and one GitLab Project
  Manager per GitLab Project.
- Use a Squad Lead for one delivery scope, including scopes that cross several
  GitLab Projects.
- Create an operation and Agent Run record before executing an ephemeral
  implementer, reviewer, researcher, or operations specialist.

Use the `agent-workspace` skill and `ax workspace` for activation, delegation,
messaging, local execution, record inspection, and Linear projection. Generated
prompts do not replace provider, lifecycle, handoff, review, or repository
policy.

## Lifecycle modes across surfaces

Explore, Plan, Execute, Review, and Finish remain the public lifecycle on every
surface. Surface capability changes what each mode can prove or mutate; it does
not create another lifecycle entrypoint.

- Explore and Review may run on any surface that can read the required target.
- Plan and Execute require a repository-visible artifact plus a dedicated
  branch/worktree with one known write owner before writing.
- Finish requires authenticated provider access and a current task-local
  publication checkpoint for the exact target.
- A hosted or cloud agent without local worktree, hook, or runtime evidence must
  report that gap and may not infer the missing evidence from machine memory.
