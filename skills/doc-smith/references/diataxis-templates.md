# Diataxis Templates

Use the appropriate template for the confirmed doc type. These are scaffolds — adapt section names to fit the topic.

---

## Doc type classification

Present this table and confirm the type with the user:

| Type | Purpose | Reader mindset | Drives toward |
|------|---------|---------------|--------------|
| **Tutorial** | Learning by doing | "I'm new, teach me" | A completed exercise |
| **Guide** | Solving a specific problem | "I know what I want" | A working outcome |
| **Explanation** | Understanding a concept | "I want to know why" | Deeper insight |
| **Reference** | Looking something up | "I need a fact" | Quick, accurate answer |

If the topic spans multiple types (e.g. a guide that also explains a concept), explain the trade-offs and recommend the primary type. Hybrid docs are usually worse than focused ones.

During review, infer the type from these signals:

| Type | Signals |
|------|---------|
| **Tutorial** | Learning-oriented; step-by-step exercise; "by the end you will have built…" |
| **Guide** | Goal-oriented; "how to…" framing; assumes reader knows what they want |
| **Explanation** | Understanding-oriented; concept discussion; "why" and "how it works" framing |
| **Reference** | Information-oriented; lookup tables; dense enumerated facts; no narrative |

---

## Guide

A guide helps a reader accomplish a specific goal. Assumes the reader knows what they want.

```markdown
---
id: <snake_case_id>
title: How to <verb> <noun>
sidebar_position: <n>
description: <what the reader achieves, under 160 chars>
---

# How to <verb> <noun>

## Overview

What this guide covers and what the reader will have working by the end.
State explicitly what this guide does NOT cover.

## Prerequisites

- [Prerequisite 1](link)
- [Prerequisite 2](link)

## Steps

### 1. <First action>

<Explanation + code block>

### 2. <Second action>

<Explanation + code block>

### 3. <Continue for each step>

## See Also

- [Related doc](link) — one-line description
```

---

## Tutorial

A tutorial teaches by doing. The reader completes a working exercise. Explains the why behind each step.

```markdown
---
id: <snake_case_id>
title: <Noun>: a tutorial
sidebar_position: <n>
description: <what the reader builds and learns, under 160 chars>
---

# <Noun>: a tutorial

## Overview

What the reader will build. What concepts they will learn. Who this is for.

## Prerequisites

- [Prerequisite 1](link)
- [Prerequisite 2](link)

## Steps

### 1. <First step title>

<What to do.>

<Why this step matters — connects action to concept.>

```<language>
<code>
```

### 2. <Second step title>

<Continue for each step.>

## Conclusion

What the reader accomplished. What concepts were demonstrated. Suggested next steps.

## See Also

- [Related doc](link) — one-line description
```

---

## Explanation

An explanation helps the reader understand a concept, decision, or system. No instructions — reader-driven exploration.

```markdown
---
id: <snake_case_id>
title: <Concept name>
sidebar_position: <n>
description: <what concept is explained and why it matters, under 160 chars>
---

# <Concept name>

## Overview

What this explanation covers. Why the concept exists. What problem it solves.

## <Core concept section>

<Prose explanation. Use diagrams where they clarify structure or flow.>

```mermaid
<diagram>
```

## <Second concept section>

<Continue for each aspect of the topic.>

## <Trade-offs / Alternatives / History> (include if relevant)

## See Also

- [Related doc](link) — one-line description
```

---

## Reference

A reference doc is a lookup resource. Dense, accurate, and scannable. No narrative.

```markdown
---
id: <snake_case_id>
title: <Topic> reference
sidebar_position: <n>
description: <complete list of what is documented, under 160 chars>
---

# <Topic> reference

## Overview

What this reference documents. Who it is for.

## <Item or category>

| Field / Option | Type | Default | Description |
|---------------|------|---------|-------------|
| `name` | string | — | ... |

## <Next item or category>

<Continue for each item.>

## See Also

- [Related guide](link) — one-line description
```
