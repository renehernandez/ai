## ADDED Requirements

### Requirement: Generated adapter lifecycle overlay
AX OpenSpec synchronization SHALL apply and validate a compact repository lifecycle overlay to every generated explicit-only OpenSpec adapter before computing its managed content hash.

#### Scenario: Explore adapter is generated
- **WHEN** AX normalizes `openspec-explore`
- **THEN** the adapter remains explicit-only and read-only
- **AND** it does not claim artifact-write authority

#### Scenario: Propose adapter is generated
- **WHEN** AX normalizes `openspec-propose`
- **THEN** the adapter operates within Plan authority
- **AND** follows the repository OpenSpec artifact contract

#### Scenario: Apply adapter is generated
- **WHEN** AX normalizes `openspec-apply-change`
- **THEN** the adapter operates within Execute ownership
- **AND** preserves the repository POC, review, task-state, and publication boundaries

#### Scenario: Archive adapter is generated
- **WHEN** AX normalizes `openspec-archive-change`
- **THEN** incomplete or unverified work blocks archival
- **AND** final archival remains owned by the last Execute delivery unit

#### Scenario: Generated content drifts
- **WHEN** an adapter lacks its required lifecycle overlay or has a mismatched managed hash
- **THEN** AX validation reports drift
- **AND** repeated sync regenerates the same canonical content without hand edits
