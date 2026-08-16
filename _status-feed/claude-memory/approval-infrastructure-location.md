---
name: approval-infrastructure-location
description: Where approval records are stored and how approval system works
metadata: 
  node_type: memory
  type: reference
  originSessionId: 11eaf307-e4d9-437e-b2c0-ab78a156a117
---

## Approval Records Locations

**Tool Permission Approvals:**
- `skills-runtime/approval-cache.json` — 392 total requests, 67 auto-approved, 2 manual
- `skills-runtime/permission-config.json` — Whitelist of safe tools
- `skills-runtime/approvals-manifest.json` — Command-level auto-promotion at threshold=2

**Code Review Approvals (Legacy):**
- No centralized log (was UI-based, reactive approval after violations)
- User reported "50+ approval clicks before lunch" issue due to zone violations

**Policy Validation (NEW — Phase E.0):**
- `.husky/prepare-commit-msg` — Git hook that runs validator on every commit
- `tools/git-policy-agent/PolicyValidator.js` — Real-time zone violation blocker
- Blocks commits BEFORE they're created, not after (zero approval friction)
- Reads `AGENTS.md` as source of truth for zone ownership

## Complete Documentation

See `docs/APPROVAL_INFRASTRUCTURE.md` for detailed structure, whitelist system, and audit analysis guidance.

**Key Insight:** PolicyValidator solves "50+ approval clicks" problem by preventing violations at commit time. No approval log needed because violations never reach approval system.

---

## How It Works (TL;DR)

1. User runs: `git commit -m "[claude] Feature"`
2. `.husky/prepare-commit-msg` hook fires
3. PolicyValidator checks:
 - Tool prefix is `[claude|copilot|gemini|human]`
 - Staged files match zone owner
 - No cross-zone bundling
4. If all pass: commit proceeds (exit 0)
5. If any fail: commit blocked (exit 1), error message shown

**Result:** 0 approval clicks needed. Violations impossible.

**Next audit:** Check git history for commits made BEFORE PolicyValidator was deployed (before commit ca4ceba) to see which ones had zone violations that would have been blocked.
