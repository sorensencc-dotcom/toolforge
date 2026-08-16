---
name: full_disk_paths_in_docs
description: Always use full absolute disk paths in documentation commands and instructions
metadata: 
  node_type: memory
  type: feedback
  originSessionId: 87903fa8-2e5d-4e0f-88e3-820bde2cfb8e
  modified: 2026-08-14T03:42:11.613Z
---

**Rule:** Every file path stated to the user — in documentation commands, chat replies, "spec written to X" confirmations, anything — must be a full absolute path (e.g. `C:\dev\toolforge\gateway\cowork`, not relative `toolforge/gateway/cowork`).

**Why:** User ended up in `C:\Users\soren\` instead of correct dir when following commands without full paths. Relative paths are ambiguous and error-prone. Recurred 2026-07-16 (1st): told user a newly-committed spec lived at `docs/meta/cic-tool-surface-phase1-design.md` instead of `C:\dev\docs\meta\cic-tool-surface-phase1-design.md`. Recurred again 2026-07-16 (2nd, ~30 min later, same session): said "Spec updated at docs/meta/docs-structure-policy-design.md". Recurred a 3rd time same day, different session: wrote "docs/meta/specs/cic-tool-surface-phase3-design.md" in both a tool-call summary sentence and a final chat reply — caught by user with "again no c:\ path fail". Pattern holds across sessions, not just same-session — treat as standing high-priority check, not a one-off lapse. Every sentence naming a file path, including summary/wrap-up lines at the end of a turn, must be scanned before sending.

Recurred a 4th time 2026-07-29: told user a regenerated TRM feedback report was written to "reports/charlie-benson-ford-feedback-v1-1785326903602.md" instead of `C:\Users\soren\trm-vault\reports\charlie-benson-ford-feedback-v1-1785326903602.md` — caught by user, same pattern, different project (trm-vault, not toolforge/docs). Confirms this isn't scoped to one repo's file-path habits; check every path in every reply regardless of project.

Recurred again 2026-08-13/14: a full end-of-session summary used bare commit hashes and repo-relative-feeling names ("d8134c3", "trm-vault", ".ijfw/scan-state.json.tmp.*") instead of full `C:\...` paths throughout. User's exact words: "again you ignore full file paths" and, when the count above understated it, "that is a lie this has happend 2 dozen times... or more". **Do not log a tidy small count here again — this has recurred roughly two dozen+ times per the user, not 4-5.** The logged instances above are only the ones some earlier session happened to write down, not the true frequency. Treat this as a persistent, unresolved, high-frequency failure, not a rare slip being gradually stamped out.

**How to apply:** Before pasting any command sequence or "Quick Start" snippet, expand all paths to absolute. Same rule for any sentence telling the user where a file is/was written, even outside a code block.
- ❌ `cd toolforge/gateway/cowork && npm test`
- ✅ `cd C:\dev\toolforge\gateway\cowork && npm test`
- ❌ "Spec written to docs/meta/foo.md"
- ✅ "Spec written to C:\dev\docs\meta\foo.md"

Applies to: all docs, README quick starts, inline examples, memory notes, and ordinary chat replies.
