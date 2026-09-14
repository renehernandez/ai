# Plain English for technical answers

## Outcome

Agents explain technical work in the simplest English that keeps the full
meaning, including when the reader is an expert. This applies to progress
updates, answers, and documents.

## Approach

Extend `rules/communication.md`, the existing shared rule installed by both AX
profiles. Keep its requirements for complete explanations, exact technical
names, evidence, and uncertainty. Add concrete examples and a short instruction
to review the wording before sending. Explain necessary terms where they first
appear; replace avoidable workflow jargon with the action it describes.

Reuse the existing communication tests and model evaluation approach. Test
actual answers for clarity and preserved meaning, rather than treating a
readability score or a matching phrase as proof. No new runtime service,
dependency, or writing-rule owner is needed.

## Acceptance and proof

Compare answers before and after the change using the same technical proposal,
progress update, and unfamiliar concept. The answers must make the action,
reason, and relevant limits clear, explain necessary jargon, and retain exact
identifiers and uncertainty. Include the reported TypeScript hook example as
failure evidence. Keep evaluation transcripts in the task.

## Delivery

One atomic change with its plan, rule, and focused regression coverage in one
draft GitLab MR. Run the repository validators and native commit hooks, review
the committed change, and follow CI and Nitro feedback. Merge and live AX sync
remain outside this request.
