---
name: feedback-edit-tool-crlf-normalization
description: "In c:\\Dev, the Edit/Write tools rewrite whole CRLF files to LF; use sed for token edits in CRLF-line-ending files"
metadata: 
  node_type: memory
  type: feedback
  originSessionId: b33a28c8-bf92-4447-87b3-a388c4b35fa2
  modified: 2026-09-02T19:11:17.652Z
---

In `c:\Dev`, many tracked files have CRLF line endings and their committed
blobs are also CRLF (`core.autocrlf=false`, no `* text=auto` in `.gitattributes`).
The `Edit` / `Write` tools write the whole file back with **LF** endings even
when only one line changed. Result: `git add` then `git diff --cached --stat`
shows the entire file changed (e.g. 294 lines for a one-token edit), 817-line
whitespace churn across 8 files in one case.

**Why:** the tool normalizes EOL on full-file write; `git diff --ignore-all-space`
confirms the real change is tiny.

**How to apply:** for edits that touch only a few lines in a CRLF file under
`c:\Dev`, use `sed -i 's/old/new/g' <file>` from the Bash tool — sed treats `\r`
as content and preserves CRLF byte-for-byte on unchanged lines. After editing,
verify with `git diff --stat` before staging; expect line counts to match the
number of lines you actually changed. Revert a botched Edit with
`git checkout -- <files>` and redo via sed.

Related: [[feedback_full_disk_paths]], [[session-wrap-2026-09-02-claude-api-prompt-audit]]
