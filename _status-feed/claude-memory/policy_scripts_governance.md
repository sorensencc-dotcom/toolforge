---
name: policy_scripts_governance
description: "All scripts (.ps1, .sh, .bat, etc.) go in C:\\dev\\scripts\\ — canonical centralized location"
metadata: 
  node_type: memory
  type: feedback
  originSessionId: c0df381f-758f-4ca2-a228-6908dcc220f7
  modified: 2026-07-20T00:41:29.526Z
---

**Rule:** All scripts (.ps1, .sh, .bat, .cmd, etc.) → `C:\dev\scripts/`

**Why:** Centralized governance, PATH discovery, clear separation from source code, consistent enforcement.

**How to apply:** When creating utility/setup/deployment/maintenance/automation scripts, place them in `C:\dev\scripts/` with subdirectories by category (optional). Preserve file type extension. Use kebab-case naming.

**Not included:** Skill source code (skills/), test scripts (with test suites), npm run scripts (package.json), temporary/generated scripts (scratchpad).

**Policy location:** `docs/meta/governance/scripts-governance.md` (Tier 1 authority for amendments)

**Established:** 2026-07-19
