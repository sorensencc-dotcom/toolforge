---
name: finding-secret-scan-sk-false-positive-2026-07-26
description: "c:\\dev pre-commit secret-scan regex false-positives on any word-uuid path ending in \"sk-\"; fixed, recurs if reverted"
metadata: 
  node_type: memory
  type: project
  originSessionId: de2f1c5c-6819-41a4-9422-e6d06c50274d
  modified: 2026-07-26T12:54:33.143Z
---

`scripts/secret-scan-hook.sh` line 19 pattern `sk-[a-zA-Z0-9_-]{20,}` had no word-boundary guard. It matched inside ordinary words: "**task**-0fde6b9d-..." contains "**sk-**0fde6b9d-..." as a substring (t-a-**sk**-0fde...). Any staged path shaped `<word-ending-in-sk>-<uuid>` — `task-<uuid>.md`, `desk-<id>`, `risk-<id>` — blocked the commit as a fake credential hit. `.ijfw/scan-state.json` indexes lots of `proposal-task-<uuid>.md` files from `rewrite-mcp`, so this recurred repeatedly, not a one-off.

Fixed 2026-07-26 (commit `cc6971b`): anchored to `(^|[^A-Za-z0-9])sk-[a-zA-Z0-9_-]{20,}` — requires a non-alnum char (or string start) before `sk-`. Verified real keys (always preceded by whitespace/quote/`=`) still caught; the `task-<uuid>` false positive no longer matches.

**Why:** the rest of the pattern set (`AIza`, `ghp_`, `github_pat_`, `xox[bp]-`, `AKIA`) is fairly safe from word-embedding since they're mixed-case/underscore-heavy; `sk-` was the only offender because it matches the literal end of common English words.

**How to apply:** if this scanner or a similar credential regex gets rewritten/reverted, re-check for the same word-boundary gap. `.ijfw/scan-state.json` is now gitignored (pure regenerated cache) so it won't trip the scanner going forward regardless.
