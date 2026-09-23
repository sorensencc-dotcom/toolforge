---
name: feedback_check_before_doubting_docs
description: "Voiced skepticism about a real, working WhichLLM system (called it possibly LLM-hallucinated) without grepping for the actual scripts/artifacts first — they existed exactly as documented."
metadata: 
  node_type: memory
  type: feedback
  modified: 2026-09-13T01:46:41.098Z
  originSessionId: 9db2ecc3-802c-4e47-9326-f1dcdbbb6aa9
---

In the Helix Phase 8 contract-request session (2026-09-12), flagged `whichllm-model-selection-evaluator.md` as suspect (`verification_status: verified` + `synthesized_by: claude` frontmatter, plus a "1.05M ctx at $0.00" line) and told the user to confirm it was real before treating it as authoritative. User pushed back hard: the system is real and fully documented across `C:\dev\scripts\whichllm-bfcl-evaluator.{mjs,py}`, `npm run sweep:whichllm` (→ `CIC-GOVERNANCE`), and `_integration/model_selection.json` artifacts in kb-sync/trm/viking-phase3 — all confirmed to exist with a two-minute grep once actually checked.

**Why:** [[feedback_verify_ai_design_doc_premises]] is about the opposite failure — AI docs asserting premises that turn out false. This is the mirror case: doubting a real system because its *description* had synthesis-pipeline frontmatter and one flashy-sounding line, without spending the two minutes to grep for the concrete artifacts (scripts, JSON outputs, npm hooks) the doc named. The user has real, working infra (kb-sync, TRM, graft, drift, WhichLLM) and existing docs/wiki content (toolforge GitHub wiki, NotebookLM-ingested) that answer these questions in seconds — voicing doubt before checking wastes the user's time and reads as not having done basic homework.

**How to apply:** Before expressing skepticism about whether a named system/doc reflects reality, grep for its concrete artifacts first (scripts, config, generated output files, npm/package.json entries) — same effort either direction. Only voice doubt about a doc's premises after that grep comes up empty, and even then frame it as "couldn't find X, does it exist under a different name" rather than "this looks fabricated."
