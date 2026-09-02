---
name: cybersecurity-skills-integration
description: "Anthropic Cybersecurity Skills repo (754 skills) integration into CIC pipeline, Qdrant schema, Rewrite Labs, governance layer, and skill-runtime adapter"
metadata: 
  node_type: memory
  type: project
  originSessionId: 35913245-5f3e-4f4b-85fc-8f81bd28b768
---

# Cybersecurity Skills Integration

**Goal:** Ingest 754 Anthropic Cybersecurity Skills into CIC as knowledge domain. Enable security-aware reasoning across CIC, Rewrite Labs, governance.

**Why:** 754 skills in agentskills.io standard. 5-framework mapping (ATT&CK, ATLAS, D3FEND, NIST CSF, NIST AI RMF) aligns governance. Plugs into Harvester→Orchestrator→Synthesizer. Enables security-aware redesigns. Ready compliance ontology.

**Apply:** Post-MemoryStore 23.2+. Parallel to MLA completion. Feeds Phase 4 governance, Phase 50+ family history.

---

## 1. CIC Extractor

Input: Anthropic-Cybersecurity-Skills repo. Dir: skills/<slug>/(SKILL.md, references/, scripts/, assets/). Output: CybersecuritySkill(id, title, description, domain, tags, maturity{beta|stable}, mitre_attack[], mitre_atlas[], mitre_d3fend[], nist_csf[], nist_ai_rmf[], preconditions[], triggers[], outcomes[], references{standards_md, workflows_md}, scripts[], assets[], source_path).

Pipeline: Glob skills/*/SKILL.md → parse frontmatter → normalize IDs → attach refs/scripts/assets → emit CIC artifact.

---

## 2. Qdrant Schema

**cyber_skills_meta:** Metadata-centric, zero vectors, keyword-only. Query: "all ATT&CK T1059 in PR.AC".

**cyber_skills_text:** 3072D embeddings, Cosine. 3 docs/skill: skill(title+desc+domain+tags+frameworks), standards(standards.md), workflows(workflows.md). Semantic search: "input validation web".

---

## 3. Rewrite Labs Integration

Site analysis → extract security profile (stack, auth, surfaces, sensitivity) → query cyber_skills_text → top-N attach as SecurityRequirement[] (skill_id, title, rationale, controls) → console Security tab: linked skills, coverage, status.

## 4. Governance Mapping

GovernanceMapping(skill_id, mitre_attack[], mitre_atlas[], mitre_d3fend[], nist_csf[], nist_ai_rmf[], domains[]). Use: Coverage dashboards (heatmaps). Policy binding: "Policy X ↔ PR.AC-3, T1190" (N skills). AMB: changes must ref supporting skill+framework.

## 5. Skill-Runtime Adapter

CyberSkillRuntimeAdapter wraps skill into 13-skill runtime. Load workflows_md → preconditions→actions→verify → LLM plan steps/checklists → summarize → trace+results. Filter: stable only, Web/Cloud/IAM MVP.

## Next

PoC: parse skill, ingest Qdrant, run via adapter. File tree spec. Governance ontology (NIST CSF 2.0 + AI RMF heatmaps). Rewrite Labs wiring. **Blocking:** repo path + next step (PoC vs spec).
