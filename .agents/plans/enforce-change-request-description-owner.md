# Enforce the change-request description owner

## Goal

Prevent explicit GitHub or GitLab requests from bypassing the existing
reviewer-facing PR/MR description policy.

## Scope

- Route every managed PR/MR create or description update through
  `change-request-create`, including provider-explicit requests.
- Keep provider adapters mechanical and preserve the existing policy, template,
  publication, and hosted-readback behavior.

No runtime hook, renderer, checkpoint journal, provider implementation, schema,
dependency, or CI change is included.

## Tasks

- [x] Close the provider-explicit routing loophole in the central and provider
      skills.
- [x] Require provider adapters to consume the centrally approved title and body
      unchanged.
- [x] Add focused regression coverage and run repository verification.
