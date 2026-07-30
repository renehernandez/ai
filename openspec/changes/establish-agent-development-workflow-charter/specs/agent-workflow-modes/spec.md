## ADDED Requirements

### Requirement: Delivery budgets distinguish removal from production growth
The system SHALL apply numeric delivery budgets according to the semantic outcome of the MR.

#### Scenario: Ordinary final MR is planned
- **WHEN** a final MR adds, replaces, migrates, or refactors behavior
- **THEN** it targets at most 10 changed files and 500 changed lines
- **AND** more than 15 files or 1,000 changed lines requires an approved semantic exception

#### Scenario: Removal-only MR is planned
- **WHEN** an MR solely retires or deletes an existing capability plus necessary reference, test, configuration, and documentation fallout
- **THEN** no numeric file or line cap applies
- **AND** semantic cohesion, safe intermediate state, ownership, and verification remain required
- **AND** declared file paths and line counts equal the authoritative target-base-to-source-head Git diff
- **AND** the semantic classification binds to the passed exact-head diff review

#### Scenario: Removal deletes an obsolete dependency
- **WHEN** dependency-manifest fallout only removes a dependency retired by the MR
- **THEN** the removal remains eligible
- **AND** adding a new dependency still fails the classification

#### Scenario: Removal includes replacement behavior
- **WHEN** the MR adds a net-new file, replacement behavior, a dependency, a migration, or unrelated refactoring
- **THEN** removal-only classification fails closed
- **AND** ordinary production budgets apply to the complete effective diff

#### Scenario: Removal has necessary fallout in an existing file
- **WHEN** an existing file requires additive reference, test, configuration, or documentation fallout to complete a removal
- **THEN** the file may remain eligible when the authoritative Git status is modified
- **AND** no numeric additions cap applies to that modified path
- **AND** the passed exact-head diff review confirms the additions are necessary fallout rather than replacement behavior

#### Scenario: Non-removal final MR exceeds 50 files
- **WHEN** a forecast or measured non-removal final MR contains more than 50 changed files
- **THEN** publication is blocked and Plan decomposes it
- **AND** no size exception may override this ceiling

### Requirement: Size exceptions bind to semantic scope
The system SHALL bind a user-approved size exception to the named artifact, accepted outcome, and unsafe-to-split rationale rather than invalidating it for every base, head, or count change.

#### Scenario: Contract-preserving repair changes the diff
- **WHEN** a patch-equivalent rebase, target-base advancement, Review repair, Nitro repair, CI repair, validation repair, or necessary path update preserves the accepted outcome
- **THEN** the existing exception remains valid
- **AND** the workflow reports the current base, head, and footprint without requesting approval again

#### Scenario: Exception rationale changes materially
- **WHEN** scope, behavior, ownership, deployment, review boundary, or practical split options change materially
- **THEN** the exception becomes stale
- **AND** renewed user authority is required before publication

### Requirement: Final OpenSpec MRs publish once and restack on promotion
The system SHALL create real-diff final OpenSpec MRs sequentially in total Git order and SHALL restack only the immediate child of a merged predecessor.

#### Scenario: Initial final stack is created
- **WHEN** reconciled final implementation produces initial coherent unit diffs
- **THEN** the root draft MR targets the normal base and each later draft MR targets its immediate predecessor
- **AND** the MRs are created one after another without empty placeholders

#### Scenario: Earlier open MR changes
- **WHEN** a predecessor receives an implementation or feedback push while descendants already exist
- **THEN** descendants are not automatically restacked
- **AND** their existing CI, review, and readiness evidence remains provisional

#### Scenario: Predecessor merges
- **WHEN** a predecessor merge is verified
- **THEN** only its immediate child retargets and restacks onto the merged result
- **AND** deeper descendants remain untouched until their own predecessor merges

#### Scenario: Promoted child is pushed
- **WHEN** the immediate child restack produces a new source head
- **THEN** its required local, CI, and hosted gates refresh
- **AND** it may become the next merge candidate after those gates pass
