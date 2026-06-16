---
name: security-review
description: >
  Use when asked to perform a security review, threat model, STRIDE analysis, or
  review a ticket (SEC-xxx), PR, or MR for security risks. Also use when the user
  says 'sec review', 'threat model this', or asks about security implications of
  a feature or design.
allowed-tools: Bash(glab:*), Read, Grep, Glob, Write
---

# Security Review Skill

Threat-first STRIDE security review for AI coding assistants and CI bots.
Drop into any repo to enable structured security analysis on tickets, PRs, and MRs.

## Invocation

### Interactive (IDE / Chat)
- "security review SEC-123"
- "STRIDE analysis for TICKET-ID"
- "threat model [feature name]"
- "security review this PR"

### CI Bot (Nitro / GitLab)
Comment on an MR:
- `@nitro security review`
- `@nitro stride analysis`
- `@nitro sec review`

### CLI
```bash
claude "security review SEC-123"
claude "security review this PR: https://git.example.com/project/-/merge_requests/456"
```

## Mode Detection

The skill adapts based on context:

| Context | Primary Input | Output Target |
|---------|---------------|---------------|
| **Ticket mode** (SEC-123) | Ticket description + codebase scan | Report as ticket comment |
| **MR/PR mode** (@nitro / "review this PR") | MR diff + codebase context | Report as MR comment |
| **Feature mode** (free-text description) | Description + codebase scan | Report in chat / document |

---

## CRITICAL INSTRUCTIONS

### DO NOT:
- Run OWASP Top 10 as a standalone checklist
- List generic findings without specific threat context
- Skip system understanding and jump to code scanning
- Produce findings that don't link back to a STRIDE threat
- Rely on cached or stale codebase knowledge

### YOU MUST:
- Complete phases sequentially: 0 → 1 → 2 → 3 → 4 → 5
- Output each phase before proceeding
- Link EVERY finding to a Phase 2 threat
- FRESH codebase scan every time
- Specific file:line references

---

## Pre-Analysis: Gather Context

### Detect Input Mode

**Ticket Mode** (e.g., "security review SEC-123"):
1. Fetch ticket via project management API (Linear, Jira, GitHub Issues)
2. Extract description, docs, linked MRs
3. Scan codebase for feature context
4. Output: report as ticket comment

**MR/PR Mode** (e.g., `@nitro security review` or "review this PR"):
1. Read MR/PR title, description, labels
2. Fetch the full diff
3. Identify linked tickets for context
4. Scan codebase around changed files
5. Output: report as MR/PR comment

**Feature Mode** (e.g., "threat model user authentication"):
1. Use description as input
2. Scan codebase for related code
3. Output: report in chat / document

### Extract Design Documents

If referenced:
- **Google Docs**: Navigate and extract via browser automation
- **Confluence/Notion**: Fetch via API or browser
- **PDFs**: Download and extract text

### Fresh Codebase Scan

**ALWAYS scan fresh.** Extract keywords and search:

```
# Models / entities
Grep: "<feature_keyword>" across codebase (files_with_matches)
Glob: "**/<FeatureName>*"

# Database schema / migrations
Grep: "<table_name>" in migration directories

# API endpoints / routes
Grep: "<feature_keyword>" in routes/controllers/handlers

# Frontend components
Glob: "**/<FeatureName>*.{tsx,jsx,vue,svelte}"

# Authorization / policies
Grep: "<feature_keyword>" in policies/permissions/guards

# Tests
Glob: "**/*<feature_name>*test*" or "**/*<feature_name>*spec*"
```

---

## Phase 0: System Understanding

**Output:** `=== PHASE 0: SYSTEM UNDERSTANDING ===`

**Complete entirely before Phase 1.**

```markdown
## 1. System Purpose
**What does this system/feature do?** [2-3 sentences]
**What value does it provide?** [Who benefits and how]

## 2. Architecture
**Major Components:**
- [Component 1]: [What it does] - [Where it runs]
- [Component 2]: [What it does] - [Where it runs]

**Communication Flow:**
User -> [Component A] -> [Component B] -> [External Service / Database]

## 3. Trust Boundaries
- **User -> System:** [How do users interact?]
- **System -> External:** [What third-party services?]
- **User -> User:** [Multi-tenant? Can users see each other's data?]
- **Privileged -> Unprivileged:** [Admin roles? Role hierarchy?]

## 4. Critical Assets
- **Secrets:** [API keys, tokens, credentials]
- **User Data:** [PII, PHI, financial data]
- **Business Resources:** [API quotas, compute, billing]
- **System Integrity:** [Configs, deployments, feature flags]

## 5. Threat Actors
- [ ] External attackers (no credentials)
- [ ] Malicious authenticated users
- [ ] Compromised accounts
- [ ] Insider threats
- [ ] Compromised dependencies
- [ ] System failures
- [ ] Automated bots / credential stuffing
```

---

## Phase 1: Implementation Status

**Output:** `=== PHASE 1: IMPLEMENTATION STATUS ===`

| Component | Status | Location |
|-----------|--------|----------|
| Database / Schema | Done / Partial / Missing | `path` |
| Backend Model | Done / Partial / Missing | `path` |
| Business Logic / Service | Done / Partial / Missing | `path` |
| Authorization / Policy | Done / Partial / Missing | `path` |
| API Layer | Done / Partial / Missing | `path` |
| Frontend | Done / Partial / Missing | `path` |
| Audit Logging | Done / Partial / Missing | `path` |
| Tests | Done / Partial / Missing | `path` |

### Data Classification

| Data Type | Present | Handling |
|-----------|---------|----------|
| PII | Yes / No | [How protected] |
| PHI | Yes / No | [How protected] |
| Financial / Payment | Yes / No | [How protected] |
| Credentials / Secrets | Yes / No | [How protected] |

---

## Phase 2: STRIDE Threat Modeling

**Output:** `=== PHASE 2: STRIDE THREAT MODELING ===`

For each component, build a STRIDE table:

### Good vs Bad Threats

**GOOD:** "Authenticated user can access other users' records by manipulating `record_id`, exposing PII"
**BAD:** "No rate limiting" (no WHO, WHAT, or business impact)

### STRIDE Table

```markdown
## Component: [Name]

| Category | ID | Threat Scenario | Actor | Existing Mitigations | Residual Risk |
|----------|-----|-----------------|-------|---------------------|---------------|
| **Spoofing** | S1 | [WHO impersonates WHO to do WHAT?] | [Actor] | [What prevents this?] | CRIT/HIGH/MED/LOW |
| **Tampering** | T1 | [WHO modifies WHAT to achieve WHAT?] | [Actor] | [What prevents this?] | CRIT/HIGH/MED/LOW |
| **Repudiation** | R1 | [WHO denies WHAT action?] | [Actor] | [What prevents this?] | CRIT/HIGH/MED/LOW |
| **Info Disclosure** | I1 | [WHO accesses WHAT data HOW?] | [Actor] | [What prevents this?] | CRIT/HIGH/MED/LOW |
| **Denial of Service** | D1 | [WHO makes WHAT unavailable?] | [Actor] | [What prevents this?] | CRIT/HIGH/MED/LOW |
| **Elevation** | E1 | [WHO gains WHAT access?] | [Actor] | [What prevents this?] | CRIT/HIGH/MED/LOW |
```

### Detailed Entry (HIGH/CRITICAL threats)

```markdown
### [ID]: [Threat Name]
**Threat:** [Full description]

**Attack Scenario:**
1. [How attacker begins]
2. [What they exploit]
3. [How system responds]
4. [What attacker achieves]

**Risk:** CRITICAL / HIGH / MEDIUM / LOW
**Likelihood:** HIGH / MEDIUM / LOW
**Impact:** [What happens if exploited]

**Codebase Status:** MITIGATED / PARTIAL / VULNERABLE
- `path/to/file:LINE` - [Current state]

**Recommended Mitigation:** [Specific fix]

**Implementation Example:**
```[language]
// Recommended fix
```

**CWE ID:** CWE-XXX
```

### Minimum Threat Count
- Spoofing: 2-3, Tampering: 2-3, Repudiation: 2, Info Disclosure: 2-3, DoS: 2, Elevation: 2-3
- **Total: 15-25 distinct threats minimum (ticket mode), 10+ (MR mode)**

---

## Phase 3: Secure Design Review

**Output:** `=== PHASE 3: SECURE DESIGN REVIEW ===`

For each HIGH/CRITICAL threat:

```markdown
## [Threat Type] - [Brief description]
**Threat from Phase 2:** [Reference]
**Required Control:** [What's needed]
**Current Status:** [Does it exist?]
```

### OWASP Cross-Reference (Validation Only)

| OWASP Category | Applicable | Covered by STRIDE Threat | Gap? |
|----------------|------------|--------------------------|------|
| A01: Broken Access Control | Yes/No | [Threat IDs] | Yes/No |
| A02: Cryptographic Failures | Yes/No | [Threat IDs] | Yes/No |
| A03: Injection | Yes/No | [Threat IDs] | Yes/No |
| A07: Auth Failures | Yes/No | [Threat IDs] | Yes/No |

If OWASP reveals a gap NOT in STRIDE, add it as a new threat.

---

## Phase 4: Threat-Focused Code Review

**Output:** `=== PHASE 4: CODE REVIEW (THREAT-FOCUSED) ===`

**Start with HIGH/CRITICAL threats from Phase 2, NOT a checklist.**

### Finding Format

```markdown
## [SEVERITY] [Finding Title]

**Threat from Phase 2:** [e.g., "E1 - Privilege escalation"]
**Threat Actor:** [From Phase 0]
**Location:** `path/to/file:LINE`

### Attack Path
1. [How attacker starts]
2. [What they exploit]
3. [What attacker achieves]

### Vulnerability
```[language]
// Vulnerable code with comments
```

### Business Impact
- [What data exposed/modified?]
- [Business/regulatory impact?]

### Recommendation
```[language]
// Concrete fix
```
```

### Self-Check (MANDATORY before report)
- [ ] Every finding links to a Phase 2 threat
- [ ] Every finding has file:line
- [ ] Every finding has a concrete fix (not just "add validation")
- [ ] No orphaned generic findings

### Security Patterns to Verify
```
SQL → parameterized? string interpolation?
User input → validated? sanitized?
Auth → session handling? token validation? bypass?
Authz → ownership checks? role checks? IDOR?
File ops → path traversal? upload validation?
Serialization → untrusted data?
Crypto → hardcoded secrets? weak algorithms?
Logging → PII/PHI in logs? audit trail?
Error handling → info leakage? stack traces?
API → rate limiting? input size limits?
```

---

## Phase 5: Compliance & Privacy Assessment

**Output:** `=== PHASE 5: COMPLIANCE & PRIVACY ASSESSMENT ===`

Only if regulated data is involved.

### HIPAA (PHI)
| Requirement | Status | Evidence | Owner |
|-------------|--------|----------|-------|
| PHI encrypted at rest & transit | Done/Missing | file:line | [Compliance Lead] |
| Audit trail for PHI access | Done/Missing | file:line | [Compliance Lead] |
| Minimum necessary principle | Done/Missing | [Details] | [Compliance Lead] |

### PCI-DSS (Payment Data)
| Requirement | Status | Evidence | Owner |
|-------------|--------|----------|-------|
| Cardholder data isolation | Done/Missing | [Details] | [Compliance Lead] |
| No storage of sensitive auth data | Done/Missing | [Details] | [Compliance Lead] |

### SOC 2 (Access Control)
| Requirement | Status | Evidence | Owner |
|-------------|--------|----------|-------|
| Access control documented | Done/Missing | [Details] | [Compliance Lead] |
| Changes logged | Done/Missing | file:line | [Compliance Lead] |

### Privacy (PII)
| Concern | Status | Evidence | Owner |
|---------|--------|----------|-------|
| PII exposure in APIs | Done/Missing | [Details] | [Privacy Lead] |
| User consent mechanism | Done/Missing | [Details] | [Privacy Lead] |
| Data retention / right to deletion | Done/Missing | [Details] | [Privacy Lead] |

**Tag stakeholders inline:**
- Compliance findings: tag your **Compliance Lead**
- Privacy concerns: tag your **Privacy Lead**

---

## Report Template

```markdown
# Security Review: [Feature/MR Title]

**Ticket:** [ID] (or **MR:** !XXX)
**Reviewer:** AI Security Analysis
**Date:** [today]
**Risk Level:** CRITICAL / HIGH / MEDIUM / LOW

---

## Executive Summary
[2-3 sentences: what, key risks, overall assessment]

**Bottom Line:** SAFE TO SHIP / NOT SAFE TO SHIP / CONDITIONAL

**Findings:** X Critical, Y High, Z Medium, W Low
**Threats Modeled:** N scenarios

---

## Phase 0: System Understanding
[output]

## Phase 1: Implementation Status
[table]

## Phase 2: STRIDE Threat Model
[tables + detailed HIGH/CRITICAL entries]

## Phase 3: Design Review
[analysis + OWASP cross-reference]

## Phase 4: Findings
[ordered by severity, each linked to STRIDE threat]

## Phase 5: Compliance & Privacy
[tables, if applicable]

---

## Implementation Checklist

### P0 - Must Fix Before Merge/Launch
- [ ] [item]: `file` - [action]

### P1 - Fix Within Sprint
- [ ] [item]: `file` - [action]

### P2 - Track for Future
- [ ] [item]: `file` - [action]

---

## Financial Impact

| Category | Cost | Basis |
|----------|------|-------|
| Data Breach | $X × [records] | Industry avg |
| Regulatory Fines | $X-$Y | Framework penalties |
| Business Disruption | $X | Downtime × rev/hr |
| Total Potential Loss | $X | |
| Fix Cost | $Y | Dev hours |
| ROI | X% | |

---

*AI-assisted STRIDE analysis. Requires human verification.*
```

---

## Post-Review Actions

### Ticket Mode
Post the full report as a comment on the ticket.

### MR/PR Mode
Post as MR/PR comment. If too long, split into:
1. **Summary** (Executive Summary + Checklist)
2. **Full report** (collapsed `<details>` tag)

Add label: `security-reviewed` or `security-review-critical`.
If P0 findings: request changes / block merge.

### Feature Mode
Output directly in chat or save as document.

---

## Risk Register (Optional)

Maintain a shared spreadsheet accumulating risks across reviews.

**Risk ID format:** `{TICKET-ID}-{STRIDE-ID}` (e.g., `SEC-155-S1`)

**Sheets:**
1. Risk Register (33 columns: Ticket ID through Notes)
2. Compliance Tracker
3. Summary Dashboard (COUNTIF formulas)
4. Risk Matrix (5×5 heat map)

### 5×5 Scoring

| | Impact 1 | Impact 2 | Impact 3 | Impact 4 | Impact 5 |
|---|---|---|---|---|---|
| **L5** | 5 Med | 10 High | 15 High | 20 Crit | 25 Crit |
| **L4** | 4 Low | 8 Med | 12 High | 16 Crit | 20 Crit |
| **L3** | 3 Low | 6 Med | 9 Med | 12 High | 15 High |
| **L2** | 2 Low | 4 Low | 6 Med | 8 Med | 10 High |
| **L1** | 1 Low | 2 Low | 3 Low | 4 Low | 5 Med |

---

## Financial Impact Reference

| Industry | Cost/Record | Avg Breach |
|----------|-------------|------------|
| Healthcare | $499 | $10.93M |
| Financial | $188 | $6.08M |
| Technology | $175 | $5.45M |
| Overall | $165 | $4.88M |

```
potential_loss = breach_cost + fines + downtime + IR + legal
fix_cost = dev_hours × rate + testing + deployment
breach_probability = weighted_score / 100
risk_reduction = 0.80
roi = ((potential_loss × probability × risk_reduction) - fix_cost) / fix_cost × 100
```

---

## Customization

### Add Your Stakeholders
Replace `[Compliance Lead]` and `[Privacy Lead]` with actual names.

### Add Your Ticket System
Replace Linear/Jira references with your system.

### Codebase Patterns
See `references/codebase-patterns.md` for common search patterns, directory conventions,
and well-implemented security patterns to match against your stack.

### CI Bot Integration
See `references/nitro-integration.md` for MR-scoped Nitro trigger patterns,
comment format, and diff-focused review workflow.

---

*Version 2.1.0 — Threat-First Methodology based on STRIDE (Microsoft), enhanced with financial impact analysis.*
