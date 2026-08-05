---
name: security-review
description: Use when asked to perform a security review, threat model, STRIDE analysis, or assess a ticket, design, pull request, or merge request for security risk.
allowed-tools: Read, Glob, Grep, Bash(git diff:*), Bash(git log:*), Bash(git show:*), Bash(git status:*)
---

# Security Review

## Authority

Security Review is a read-only specialist inside Explore or Review. It may
inspect the supplied artifact, exact local diff, and surrounding code, but it
does not edit files or mutate provider state. If a hosted target is not
available locally or in supplied evidence, return to the lifecycle owner for an
exact artifact through the selected host adapter.

## Analysis contract

Start from the real system boundary, not a checklist:

1. Confirm the review target and freshness. For a diff review, identify the
   target base and source head. State any evidence that is unavailable.
2. Map security-relevant assets, actors, entry points, trust boundaries, data
   flows, and existing controls. Inspect only the code and documentation needed
   to support that model.
3. Trace plausible attack paths from an actor and entry point to an affected
   asset. STRIDE, OWASP, or CWE may help classify an evidenced path; none is a
   quota or a substitute for system understanding.
4. Validate each candidate against source evidence and reachable behavior.
   Distinguish observed facts, supported inference, and unknowns. Do not invent
   missing architecture, exploitability, impact, or controls.
5. Rank only validated findings. Severity reflects demonstrated impact and
   preconditions in this system, not generic vulnerability language.

Load [codebase-patterns.md](references/codebase-patterns.md) only when repository
structure is unfamiliar and broader search guidance is necessary.

## Finding threshold

A finding requires all of the following:

- a concrete asset and threat actor;
- a reachable or credibly reachable attack path;
- source evidence, preferably file and line locations;
- the relevant existing control or evidence that it is absent;
- a specific impact and mitigation tied to the observed boundary.

Missing evidence is an uncertainty or blocker, not a vulnerability. If no
candidate meets the threshold, report no evidenced finding and list material
coverage gaps. Do not speculate to fill categories or produce a minimum count.

## Output contract

Lead with the review target, evidence inspected, and overall disposition. Then
summarize the system model: assets, actors, trust boundaries, and material data
flows.

For each validated finding, use:

### [Severity] Finding title

**Severity:** Critical | High | Medium | Low  
**Confidence:** 0-100%  
**Asset:** affected data, capability, or system property  
**Actor:** attacker and required access  
**Attack path:** ordered path from entry point to impact  
**Evidence:** source locations and observed behavior  
**Existing controls:** effective, partial, or absent controls  
**Impact:** concrete consequence if exploited  
**Mitigation:** smallest control that breaks the path  
**Uncertainty:** missing evidence or assumptions that could change the result

Order findings by severity, then confidence. Keep non-finding hardening ideas
separate so they cannot be mistaken for exploitable defects.

## Escalation

Return `blocked` when the exact target, a material trust boundary, or required
source evidence cannot be inspected. Escalate a validated critical or high
finding to the lifecycle owner with the affected location, attack path, and
required decision. The lifecycle owner decides repair, publication, tracking,
or terminal action.
