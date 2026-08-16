---
name: learning-sed-blind-corruption
description: Repo-wide sed used for reference-fixing corrupts plan docs that contain illustrative examples of that same sed
metadata: 
  node_type: memory
  type: feedback
  originSessionId: c0df381f-758f-4ca2-a228-6908dcc220f7
  modified: 2026-07-19T19:24:06.406Z
---

**Rule**: When running repo-wide sed for reference-fixing during file reorganization, exclude the planning/design documents themselves from the target set.

**Why**: Blind sed that fixes inbound links will also rewrite the plan document's own illustrative code examples of that sed, every time. 2026-07-16: All 9 tasks in docs-meta-restructure hit this—sed loop for reference-fixing was inside the plan document's own target scope, corrupted its examples after every task, caught and fixed each time post-facto.

**How to apply**:
- Plan/design docs go outside the sed target glob
- Example: `sed -i ... $(find . -type f -name '*.md' ! -name PLAN.md ! -name DESIGN.md ! -path '.context/*')`
- Build the exclusion set up front, not after discovering corruption

**Pattern**: During file reorg multi-task execution, exclude control documents (plans, designs, specs) from blind-search operations at the start, not in the rework loop.

**Reference**: Retro 2026-07-16-5.json, process_learnings[1]
