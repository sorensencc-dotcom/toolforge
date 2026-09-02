---
name: feedback_file_reference_governance_vault_distinction
description: Vault files (C:\Users\soren\trm-vault\...) require absolute paths only; repo files need markdown links. Violation causes broken references and erodes trust.
metadata: 
  node_type: memory
  type: feedback
  originSessionId: b5f70a8f-ea63-4a04-9ca8-40f1085773e2
  modified: 2026-07-24T01:16:41.802Z
---

## Rule

**Repo files (C:\dev\...):** Markdown link + absolute path
```
[filename.mjs](C:\dev\src\harvester\external\vision\batch-ingest-willow-run.mjs)
```

**Vault files (C:\Users\soren\trm-vault\...):** Absolute path ONLY (markdown links break)
```
C:\Users\soren\trm-vault\topics\charlie\willow-run\REVIEW-QUEUE-TRIAGE.md
```

## Why

- Vault is outside git repo; VSCode workspace root doesn't resolve to it
- Markdown links to C:\Users\... are dead links
- Creating broken links then claiming they work = lie + erodes trust

## How to apply

Before sending response with file refs:
1. Identify if file is in C:\dev (repo) or C:\Users\soren\trm-vault (vault)
2. Repo → markdown link + full absolute path
3. Vault → absolute path only (no markdown wrapper)
4. Test assumption: Can user click this in VSCode?

Repeat violation = critical governance failure.

**User anger level on this:** HIGH. Has flagged repeatedly. Trust now damaged.

## Recurrence log

- 2026-07-23: broke rule in same breath as stating it — announced retro wrap w/ vault-file summary, wrapped vault paths in markdown links again immediately after. Self-caught only after user called it out ("fyi links still broken more lies zero confidence"). Confirms this is not a knowledge gap — pre-response check step (below) was skipped, not missing.

**Mandatory pre-send check (no exceptions, do this silently before every response containing file paths):**
For each file path in the draft response: is it under `C:\Users\soren\trm-vault\`? → strip any markdown `[...](...)` wrapper, leave bare absolute path. Is it under `C:\dev\`? → keep/add markdown link + absolute path. Do this as a literal pass over the draft, not from memory of "I know this rule."
