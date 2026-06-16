---
name: nitro-integration
description: Nitro CI bot integration for MR-scoped security reviews
---

# Nitro Integration

How to trigger and use the security review skill via Nitro on merge requests.

## Trigger Patterns

Comment on any MR with:
- `@nitro security review`
- `@nitro stride analysis`
- `@nitro threat model`
- `@nitro sec review`

## MR Context Gathering

```bash
# Get MR metadata
glab mr view <MR_IID> --output json

# Get the diff
glab mr diff <MR_IID>

# List changed files
glab mr diff <MR_IID> --name-only
```

## MR-Scoped Differences

| Aspect | Full Review | MR Review |
|--------|-----------|-----------|
| Scope | Entire feature / system | MR diff + surrounding context |
| Min threats | 15-25 | 10+ |
| Compliance phase | Full (HIPAA/PCI/SOC2) | Only if MR touches regulated data |
| Financial impact | Full analysis | Skip unless critical |
| Output | Ticket comment or document | MR comment (collapsible) |

## MR Comment Format

```markdown
## Security Review: !<IID>

**Risk Level:** CRITICAL / HIGH / MEDIUM / LOW
**Findings:** X Critical, Y High, Z Medium
**Verdict:** SAFE TO MERGE / CONDITIONAL / NOT SAFE TO MERGE

### Summary
[2-3 sentences]

### P0 — Must Fix Before Merge
- [ ] [Finding]: `file:line` — [action]

### P1 — Fix Within Sprint
- [ ] [Finding]: `file:line` — [action]

<details>
<summary>Full STRIDE Analysis (click to expand)</summary>

[Full Phase 0-4 output]

</details>

---

*AI-assisted STRIDE analysis. Requires human verification.*
```

## Labels

- Add label: `security-reviewed`
- If P0 findings: add `security-review-critical` and **request changes**
- If no P0 findings: approve or leave as informational
