---
name: governance-v2-principle-driven-rewrite
description: "Global Operating Rules v2.0 rewrite — principle-driven simplification (359→158 lines, 56% reduction)"
metadata: 
  node_type: memory
  type: project
  originSessionId: 279a5e26-a6ad-4218-af58-2bc6efe55319
---

## Governance Simplification: v1.5 → v2.0

**Date:** 2026-07-12  
**Commit:** main#81497b6  
**Approval:** Tier 1 (Chris)

### What Changed

**From:** 15 sections, 6 reasoning modes, 5-class taxonomy, Phase 0 + Audit-First gates  
**To:** 8 sections, 5 core principles, 3-class taxonomy, single Conformance Gate

### 5 Core Principles (v2.0)

1. Tier 1 Decides, Tier 2 Executes, Tier 3 Automates
2. Memory Shapes Strategy (long-term > project > working)
3. Safety > Process (boundaries absolute; gates flex)
4. Conform Before Shipping (patterns/infra/design align at charter phase)
5. Document Decisions, Not Steps (why/what, not how-to minutiae)

### Structural Reductions

| Item | v1.5 | v2.0 | Reasoning |
| --- | --- | --- | --- |
| Sections | 15 | 8 | Merged charter lifecycle + document governance into one |
| Lines | 359 | 158 | Removed redundancy, example-heavy subsections, process theater |
| Reasoning modes | 6 | → 5 principles | Folded modes into principle-driven framing |
| Output classes | 5 (Class 1–5) | 3 (Governance/Operational/Template) | Granularity gap eliminated; easier classification |
| Phase 0 gate | 30min (4-step Q1–Q4) | → Conformance Gate (20min, 3 checks) | Simpler entry/exit, same pattern conformance teeth |
| Audit-First scope lock | 3 parallel streams, 30min | Merged into Conformance Gate | Single-pass gate reduces friction |
| Drift signals | 7 (detailed list) | 5 (core signals only) | Kept actionable ones; removed redundancy |

### Kept Intact

- 3-tier operator model (Tier 1 = decision, Tier 2 = execution, Tier 3 = automation)
- 3-layer memory architecture (working/project/long-term)
- Safety boundaries (absolute, no exceptions)
- Charter lifecycle concept (DRAFT → DISCUSS → LOCKED → SHIPPED)
- Design system authority (Cast Iron Charlie default)
- WCAG accessibility baseline

### Impact

**Compliance friction:** Reduced. Principles are clearer than 6 reasoning modes. 3 classes vs 5 = faster decision.

**Governance teeth:** Unchanged. Tier 1 gates, safety boundaries, drift response all preserved.

**Process clarity:** Improved. Why-driven (5 principles) replaces how-driven (6 modes + 15 sections).

**Maintenance:** 56% fewer lines = easier to update quarterly, audit, and explain to new operators.

### Why This Approach (Andrej Karpathy Reference)

Analyzed https://github.com/multica-ai/andrej-karpathy-skills:
- Principle-driven governance (4 principles in 1 file) scales better than rule-heavy models
- Adopted their framing (principles > processes) while keeping our Tier 1 gates + safety boundaries
- Our simplified v2.0 balances their minimalism with our need for formal decision history

### Next Steps

- Monitor conformance gate effectiveness (first 3 phases using v2.0)
- Quarterly review (Oct 2026): Phase 0 removal impact, Tier load, memory growth
- If principle-driven works well, consider extending to other governance domains (design, testing, etc.)
