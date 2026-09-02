---
name: instruction-format-preference
description: Include full directory paths with all instructions; no ambiguity on where to run commands
metadata: 
  node_type: memory
  type: feedback
  originSessionId: 621b2118-696d-495a-a804-a2683ba9c11c
---

# Instruction Format Preference

**Rule:** Always include full directory path at start of instruction sequences.

**Why:** Avoids "wrong directory" errors; user immediately knows context + working directory.

**How to apply:** 
- Every instruction sequence starts with: `cd <full-path>` or `# Run from: <full-path>`
- Every command shows full file paths (not relative)
- Multi-step sequences show path at each step if context changes

**Example (WRONG):**
```bash
npm test -- phase4-ci-gate-verification
```

**Example (RIGHT):**
```bash
# Run from: c:\dev
cd c:\dev
npm test -- phase4-ci-gate-verification
```

**Example with file edits (RIGHT):**
```bash
# Run from: c:\dev
cd c:\dev
npm test -- phase4-ci-gate-verification

# Then from: c:\dev
git commit -m "Phase 4 tests passing"

# Edit file (absolute path)
# c:\dev\config\phase4-migration-config.json
```
