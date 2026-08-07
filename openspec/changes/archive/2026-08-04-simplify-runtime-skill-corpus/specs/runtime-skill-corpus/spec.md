## ADDED Requirements

### Requirement: Runtime instruction ownership
Repository-owned runtime guidance SHALL use the established ownership hierarchy instead of duplicating policy and mechanics across skills.

#### Scenario: Shared policy applies to several skills
- **WHEN** lifecycle, verification, provider, Git, or handoff policy applies across specialists
- **THEN** `AGENTS.md` or the canonical rule owns that policy
- **AND** affected skills retain only their unique judgment and escalation

#### Scenario: A decision is deterministic
- **WHEN** a schema, parser, validator, collector, or gate can decide behavior mechanically
- **THEN** its script or schema remains the source of truth
- **AND** `SKILL.md` does not reproduce the full procedure

### Requirement: Progressive disclosure
Each managed `SKILL.md` SHALL focus on triggers, unique judgment, output contracts, and escalation points while progressively loading supporting material.

#### Scenario: Provider mechanics or templates are needed
- **WHEN** a skill reaches a provider-specific retrieval, template, example, or long-procedure decision
- **THEN** it loads the owning one-level reference or executable helper
- **AND** the main skill does not embed the full manual

#### Scenario: Prompt budgets are measured
- **WHEN** corpus metrics are generated
- **THEN** router, reviewer, lifecycle, and reference budgets are reported as design pressure
- **AND** word count alone does not fail validation

### Requirement: Distinct specialist leverage
Corpus simplification SHALL preserve the named behavior-bearing specialists rather than replacing them with generic lifecycle modes.

#### Scenario: Brainstorming is selected
- **WHEN** divergent exploration begins
- **THEN** Brainstorming visibly provides its Orientation Map and bounded Discussion Queue
- **AND** stops at its convergence boundary

#### Scenario: Start Project is selected
- **WHEN** new-effort intake applies
- **THEN** Start Project returns the complete read-only Project Brief
- **AND** does not collapse into issue breakdown or mutation

#### Scenario: Change Request Create is selected
- **WHEN** a reviewer-facing pull or merge request description is needed
- **THEN** Change Request Create remains the sole title/body owner
- **AND** preserves templates and human-owned sections

#### Scenario: Nitro feedback is selected
- **WHEN** configured Nitro evidence is collected
- **THEN** the specialist preserves provider identity and exact-head freshness
- **AND** routes provider requests to Finish and findings to Review or Execute

#### Scenario: OpenSpec Tasks is selected
- **WHEN** `tasks.md` needs delivery audit
- **THEN** the specialist returns its semantic structured disposition
- **AND** deterministic scripts retain parsing, identity, and proof-position gates

### Requirement: Lifecycle mode boundaries
Plan, Execute, Review, and Finish SHALL retain their distinct authority and escalation decisions while shared mechanics remain in canonical rules and scripts.

#### Scenario: Shared lifecycle prose is removed
- **WHEN** a mode skill stops repeating worktree, POC, budget, hook, publication, or exact-head mechanics
- **THEN** the canonical rule or script still owns that behavior
- **AND** the mode retains the decisions only its authority can make

#### Scenario: Runtime prose is reduced
- **WHEN** a lifecycle or specialist skill is simplified
- **THEN** its declared tool capabilities still support its cross-repository responsibilities
- **AND** prompt reduction does not silently narrow repository discovery, project-native execution, structured confirmation, or required document ownership

### Requirement: Evidence-backed Security Review
Security Review SHALL be read-only and SHALL report only evidence-backed threat analysis.

#### Scenario: Security finding is valid
- **WHEN** Security Review reports a threat
- **THEN** it identifies a plausible actor, reachable attack path, affected asset, repository evidence, residual risk, and concrete mitigation

#### Scenario: Non-analysis responsibility is proposed
- **WHEN** a security workflow would mutate provider state, require a fixed threat quota or phase transcript, calculate speculative financial impact, or emit generic compliance boilerplate
- **THEN** Security Review refuses or omits that responsibility
- **AND** routes any legitimate external action to its lifecycle owner

### Requirement: Historical evidence placement
Historical RED/GREEN narratives, session identifiers, pressure transcripts, and validation histories SHALL not remain in runtime skill instructions after equivalent regression coverage exists.

#### Scenario: Equivalent coverage passes
- **WHEN** an affected behavior has a passing eval or deterministic fixture
- **THEN** its historical runtime narrative is removed
- **AND** only reusable examples or procedures remain in references

#### Scenario: Coverage is missing
- **WHEN** runtime prose is the only evidence for an essential behavior
- **THEN** the prose remains until equivalent coverage is established

### Requirement: Phrase-independent regression tests
Tests SHALL assert behavior, state, routing, freshness, escalation, or deliberate output structure instead of incidental wording.

#### Scenario: Wording is not an output contract
- **WHEN** a skill is simplified without changing behavior
- **THEN** tests accept semantically equivalent prose
- **AND** continue to reject behavior and authority regressions

#### Scenario: Wording is deliberate
- **WHEN** a visible heading, provider template, or machine-readable contract is part of the accepted output
- **THEN** a focused structural assertion may preserve that exact element

### Requirement: Complete corpus disposition
Every starting managed runtime skill SHALL be retained, simplified, progressively disclosed, or retired according to one explicit reviewed disposition.

#### Scenario: Corpus closure runs
- **WHEN** the change reaches integrated closure
- **THEN** all 34 starting skills have an implemented disposition, 33 retained runtime skills have passing affected coverage, and `compound` is retired
- **AND** the corpus report accounts for managed skills, generated adapters, references, scripts, and embedded evidence sections

### Requirement: Compound retirement
The runtime SHALL not expose Compound as a fourth or sixth lifecycle owner.

#### Scenario: User requests retrospective learning capture
- **WHEN** the user explicitly requests a retrospective, solution note, or reusable learning document
- **THEN** Explore routes the documentation outcome to `doc-smith`
- **AND** later repository mutation follows Plan or Execute authority

#### Scenario: Runtime profiles synchronize
- **WHEN** AX installs the managed skill set after this change
- **THEN** `compound` is retired from the selected profiles
- **AND** no automatic post-task documentation mutation replaces it
