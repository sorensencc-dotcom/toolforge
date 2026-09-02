---
name: session-wrap-2026-07-17-dual-clone-collapse
description: Collapsed C:\dev\toolforge nested clone into C:\dev; surfaced and fixed a repo-wide hardcoded-path bug across 26 scripts
metadata: 
  node_type: memory
  type: project
  originSessionId: 4273f35c-4ab5-478e-8e9b-57bf3f30e162
---

Resolved the dual-clone TODOS item (2026-07-17): `C:\dev\toolforge` was a nested clone of the same `sorensencc-dotcom/toolforge` remote as `C:\dev` itself — 5 commits behind, dirty with stale regenerated audit/skillpack files. Deleted it, kept `C:\dev` as sole clone (already matched origin/main). Salvaged one real untracked artifact first (`test-run-tool-smoke.ps1`, 11/11 passing, existed nowhere else).

Deleting the nested clone broke everything: pre-commit/post-merge hooks, `multi-repo-orchestrator.ps1`, `ci-pipeline.ps1`, and — once those were fixed — **26 total `.ps1` files** turned out to hardcode `C:\dev\toolforge\` as their root instead of deriving it from where they actually run. Same bug class as the `run-tool.ps1` `TOOLFORGE_ROOT` fix logged in TODOS.md 2026-07-17 ("`run-tool.ps1` repaired") — that fix was never applied repo-wide, just to the one script someone happened to be debugging. Mechanical literal-string replace fixed all 26 in one pass; pre-commit validator + pre-push security auditor (40 skills) both ran clean after.

**Why:** [[learning-two-skill-trees]] already flagged that `toolforge/` and `C:\dev` were two clones of the same remote — this session executed the actual collapse decision.

**How to apply:** If a fresh hardcoded-root bug surfaces in any toolforge `.ps1` script again, check whether it's isolated or another instance of this same systemic pattern — grep the literal path repo-wide before fixing just the one file in front of you. `manifest.json` conflicts were the recurring collision symptom before the collapse; that symptom should not recur now that there's only one clone.
