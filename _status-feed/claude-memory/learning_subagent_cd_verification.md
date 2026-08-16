---
name: learning-subagent-cd-verification
description: "Subagents must verify checkout as literal first bash command, not rely on prose instructions"
metadata: 
  node_type: memory
  type: feedback
  originSessionId: c0df381f-758f-4ca2-a228-6908dcc220f7
  modified: 2026-07-19T19:23:21.464Z
---

**Rule**: Subagents dispatched with "work from \<path>" instructions cannot reliably cd there on their own. Must force verification as their literal first bash command.

**Why**: Prose instructions do not guarantee execution. Manual git worktrees (not native worktree tool) + no cd verification = silent operation on wrong checkout. Task 1 and Task 9 both hit this (committed to main, verified against wrong tree).

**How to apply**:
```bash
cd <expected_path> && \
git rev-parse --show-toplevel && \
git rev-parse HEAD
```

Check that output matches expected values. If mismatch, halt and report before proceeding.

**Pattern**: Bake this pattern into every subagent dispatch after 2026-07-16. Prevents silent cross-checkout contamination.

**Reference**: [[incident_git_reset_data_loss_2026-07-16]]
