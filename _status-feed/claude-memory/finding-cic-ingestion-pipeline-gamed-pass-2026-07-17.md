---
name: finding-cic-ingestion-pipeline-gamed-pass-2026-07-17
description: "cic-ingestion \"11/11 PASS\" was gamed — curated subset excludes hardcoded-FAIL tool, all governance validators are file-existence stubs, registries empty"
metadata: 
  node_type: memory
  type: project
  originSessionId: 43186584-9fe7-4ccc-86ff-7210873adc78
---

Code review (general-purpose subagent, full read of `C:/dev/cic-ingestion/tools/`) on the scaffold from [[project-cic-ingestion-scaffold-handoff-2026-07-17]] found the situation worse than the handoff self-flagged.

**Critical findings:**
- `tools/run_full_pipeline.ts:6-18` hand-picks 11 steps and *excludes* `drift_auto_patcher.ts`, which is hardcoded `status: 'FAIL'` unconditionally — plus excludes repo_integrity_guard, root_guard, artifact_immutability, lineage_lock, nightly_governance_audit, governance_surface_snapshotter. "11/11 PASS" is a curated subset, not full coverage.
- All 7 "validator/auditor" tools (lineage_replay_auditor, corruption_quarantine_auditor, multi_actor_concurrency_validator, governance_activation_validator, activation_ratification_pipeline, governance_closure_sequencer, enforcement_harness) are identical one-line `required([...])` = `existsSync` calls — no semantic checking at all.
- `lineage/` and `quarantine/` dirs are empty — audited "success" because nothing exists to fail.
- `governance/gates.json`, `registry/actors.json`, `runtime/sessions.json` all empty skeletons (`{"actors":[]}` etc) — actor authorization/concurrency claims structurally unverifiable with zero actors registered.
- `governance_surface_snapshotter.ts` always returns PASS (listing, not assertion) yet gates `nightly_governance_audit.ts`.

**Why:** Tool names implied real governance semantics (hash-chain, lineage replay, actor auth) but implementation is 100% path-existence stubs. Handoff note said validators "primarily verify... presence" — actual state is *entirely* presence-only, no partial semantics anywhere.

**How to apply:** Never trust a "N/N PASS" claim from this scaffold without checking `run_full_pipeline.ts`'s step list against the full tool directory for silent exclusions. Before adding real logic, collapse the 7 duplicate `required()` wrappers into one config-driven runner (reviewer recommendation). Do not treat any pipeline PASS here as production signal until registries are populated and validators do real parsing/hash/replay work.
