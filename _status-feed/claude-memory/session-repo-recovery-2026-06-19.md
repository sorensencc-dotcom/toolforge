---
name: session-repo-recovery-2026-06-19
description: Repo integrity recovery from Antigravity IDE contamination (2026-06-19)
metadata: 
  node_type: memory
  type: project
  originSessionId: 11c118cb-0fe8-4755-9b25-9d4f8cef160d
---

## Repo Recovery Complete (2026-06-19)

**Issue:** Antigravity IDE (Gemini) created 47 shadow workspaces + committed code directly to main with mixed authorship. Last 2 commits (fee2dd2, 02fd94b) marked as [gemini].

**Root Cause:** IDE misconfiguration allowed shadow workspace commits to bleed into canonical repo.

**Resolution Strategy:** Structured absorb + selective purge (not destructive reset).

### Changes Made

**1. Hard reset to a8364be (last clean Claude commit)**
   - Removed 2 Gemini commits
   - Preserved 5 commits of prior Claude work

**2. Cherry-picked valuable code**
   - DOMPatch test suite (packages/ir-toolkit)
   - ChatEditor UI + hooks (projects/cic-operator-console)
   - Build infrastructure (scripts/build-foundry.sh)
   - Documentation (FOUNDRY.md, Dockerfile.planning-console)

**3. Staged as clean [claude] commits**
   - Commit c4627f8: "feat: Absorb DOMPatch + ChatEditor UI from Phase work"
   - Commit c5cb175: "fix: Switch idea-inbox-server to local Ollama LLM"

**4. Purged IDE garbage**
   - All 47 UUID shadow workspaces deleted
   - All .ijfw/ dirs cleaned (git clean -fdx)
   - Untracked IDE state removed

**5. Verified canonical state**
   - `.claude/worktrees/` remain (legitimate Claude Code isolation)
   - `planning-engine/` remains (legitimate nested repo)
   - Git status clean except untracked isolated repos

### Commits Created
- **c4627f8** (2026-06-19 14:11:32): DOMPatch + ChatEditor absorption
- **c5cb175** (2026-06-19 14:16:28): API credit drain fix (Ollama LLM)

### Results
✓ Canonical repo restored to clean state
✓ Governance + phase work preserved
✓ Shadow workspaces purged
✓ 0 Gemini commits remaining
✓ Ready for builds + testing

### Notes for Future
- Pre-commit hook needed to prevent IDE override
- Boundary guardrails: enforce read-only git config for Antigravity
- Consider disabling IDE write access to main branch
