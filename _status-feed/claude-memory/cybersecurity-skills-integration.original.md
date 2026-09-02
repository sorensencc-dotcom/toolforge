---
name: cybersecurity-skills-integration
description: "Anthropic Cybersecurity Skills repo (754 skills) integration into CIC pipeline, Qdrant schema, Rewrite Labs, governance layer, and skill-runtime adapter"
metadata: 
  node_type: memory
  type: project
  originSessionId: 35913245-5f3e-4f4b-85fc-8f81bd28b768
---

## Cybersecurity Skills Integration — Phase Overview

**Objective:** Ingest 754-skill Anthropic Cybersecurity Skills repo into CIC as a first-class knowledge domain, enabling security-aware reasoning across CIC, Rewrite Labs, and governance.

**Why:** 
- 754 skills already in `agentskills.io` YAML+Markdown standard
- 5-framework mapping (ATT&CK, ATLAS, D3FEND, NIST CSF, NIST AI RMF) aligns with CIC governance layer
- Plugs directly into Harvester → Orchestrator → Synthesizer pipeline
- Enables security-aware redesigns in Rewrite Labs
- Provides ready-made compliance ontology for AMB governance

**How to apply:**
- Phase 23.2+ post-MemoryStore implementation
- Non-blocking; can run parallel to MLA Phase 23 completion
- Feeds into Phase 4 governance layer, CIC Phase 50+ (family history commercial venture)

---

## 1. CIC Extractor: CybersecuritySkillExtractor

**Input:** Repo root of Anthropic-Cybersecurity-Skills

**Directory layout:**
```
skills/<skill_slug>/
  SKILL.md                    # frontmatter + workflow
  references/standards.md     # frameworks + references
  references/workflows.md     # step-by-step procedures
  scripts/*.py                # runnable helpers
  assets/*                    # templates, checklists
```

**Output interface:**
```ts
export interface CybersecuritySkill {
  id: string;                 // skill_slug
  title: string;
  description: string;
  domain: string;             // primary domain
  tags: string[];
  maturity: string;           // "beta" | "stable"
  mitre_attack: string[];     // Txxxx
  mitre_atlas: string[];      // ATLAS IDs
  mitre_d3fend: string[];     // D3FEND IDs
  nist_csf: string[];         // ID.AM-1, PR.AC-3, etc.
  nist_ai_rmf: string[];      // GOV, MAP, MEA, MAN subcategories
  preconditions: string[];
  triggers: string[];
  outcomes: string[];
  references: {
    standards_md: string;
    workflows_md: string;
  };
  scripts: string[];          // relative paths
  assets: string[];           // relative paths
  source_path: string;        // SKILL.md path
}
```

**Extraction pipeline:**
1. Discover: glob `skills/*/SKILL.md`
2. Parse frontmatter → CybersecuritySkill fields
3. Normalize framework IDs (uppercase, trimmed)
4. Attach `references/*.md`, `scripts/*.py`, `assets/*`
5. Emit CIC artifact: `{ type: "CybersecuritySkill", version: "1.0", payload }`

---

## 2. Qdrant Schema — Two Collections

**Collection 1: `cyber_skills_meta`**
- Metadata-centric, zero vectors (keyword-only)
- Use for filter-heavy queries: "all ATT&CK T1059 skills in PR.AC"

**Collection 2: `cyber_skills_text`**
- Text embeddings (3072 dims, Cosine distance)
- Three documents per skill:
  - `text_kind: "skill"` — title + description + domain + tags + frameworks
  - `text_kind: "standards"` — full `references/standards.md`
  - `text_kind: "workflows"` — full `references/workflows.md`
- Use for semantic search: "input validation for web apps"

---

## 3. Rewrite Labs Integration

**Entry point:** Security context enrichment during site analysis.

1. Extract security profile (tech stack, auth patterns, input surfaces, data sensitivity)
2. Query `cyber_skills_text` → top-N skills relevant to profile
3. Attach as `SecurityRequirement[]` to redesign spec:
   ```ts
   interface SecurityRequirement {
     skill_id: string;
     title: string;
     rationale: string;
     key_controls: string[];
   }
   ```
4. Operator console → Security tab per site: linked skills, framework coverage, implementation status

---

## 4. Governance Mapping Layer

**Data model:**
```ts
interface GovernanceMapping {
  skill_id: string;
  mitre_attack: string[];
  mitre_atlas: string[];
  mitre_d3fend: string[];
  nist_csf: string[];
  nist_ai_rmf: string[];
  domains: string[];
}
```

**Use cases:**
- Coverage dashboards (per-framework heatmaps)
- Policy binding: "Policy X aligns with PR.AC-3, T1190" (backed by N skills)
- AMB governance: proposed changes must reference supporting skill + framework IDs

---

## 5. Skill-Runtime Adapter

Wraps `CybersecuritySkill` into existing 13-skill runtime.

```ts
class CyberSkillRuntimeAdapter implements RuntimeSkill {
  async run(context): Promise<any> {
    // 1. Load workflows_md from skill
    // 2. Interpret: preconditions → actions → verification
    // 3. Use LLM to plan concrete steps, generate commands/checklists
    // 4. Summarize outcomes
    // 5. Return execution trace + results
  }
}
```

Filter by: maturity (stable only initially), domain (Web, Cloud, IAM for MVP).

---

## Next Steps

1. **PoC validation** — Parse one skill, ingest into Qdrant, run via adapter
2. **File tree spec** — Blueprint for full integration (CIC repo + Qdrant DDL + governance registry)
3. **Governance ontology** — NIST CSF 2.0 + AI RMF coverage heatmaps
4. **Rewrite Labs wiring** — Security enrichment pipeline

**Blocking on:** Repo path + preferred next step (PoC vs file tree spec)
