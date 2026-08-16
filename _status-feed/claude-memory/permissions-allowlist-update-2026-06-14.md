---
name: permissions-allowlist-2026-06-14
description: Permission allowlist updated with 8 read-only Bash patterns; est. 5-15% fewer prompts
metadata: 
  node_type: memory
  type: feedback
  date: 2026-06-14
  originSessionId: 0253e0ca-9f2a-4b11-b97b-4bd94b977b92
---

## Permissions Allowlist Update — 2026-06-14

**Action:** Analyzed 30 recent transcripts; updated `C:\dev\.claude\settings.json` with read-only patterns.

**Patterns Added (8):**
1. `Bash(find *)` — 57 uses
2. `Bash(npm list)` — 18 uses
3. `Bash(npm view *)` — package metadata
4. `Bash(curl -s *)` — 13 uses (silent GET requests)
5. `Bash(curl -I *)` — header-only requests
6. `Bash(test -f *)` — 7 uses (file existence)
7. `Bash(test -d *)` — directory existence
8. `Bash(test -z *)` — string empty check

**Analysis Results:**
- Scanned: 28,029 lines, 5,456 tool uses across 30 transcripts
- PowerShell dominance: 1,385 PS uses vs. 720 Bash uses (Windows environment)
- No MCP tools used in recent sessions (50 deferred tools unused)
- Skipped: mutations (git push, npm install), arbitrary code (python, node, npx), auto-allowed (cat, ls, git, gh)

**Impact:** Est. 5–15% reduction in permission prompts

**File Status:**
✓ C:\dev\.claude\settings.json updated
✓ 8 new entries in `permissions.allow`
✓ 95+ existing entries preserved
✓ No duplicates, valid JSON

## Decision

Keep fine-grained patterns (e.g., `Bash(find *)`) over broad wildcards to block mutations while allowing variants.
