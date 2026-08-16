---
name: feedback_codex_verbatim_plan_code
description: "When handing a written implementation plan to Codex, instruct it to copy test/source code blocks verbatim -- it will otherwise retype/condense them and introduce silent syntax bugs"
metadata: 
  node_type: memory
  type: feedback
  originSessionId: 42f01400-e2ad-495c-8aab-219a5fbcf7c9
---

**Rule:** When an implementation plan (superpowers:writing-plans style, with
literal code blocks per step) is handed to Codex to execute, explicitly
instruct it to copy each code block character-for-character rather than
retyping or condensing it.

**Why:** During CIC Tool Surface Phase 1 (2026-07-16), Codex's Task 1 attempt
reported a "hung" test run during `npm install`/Jest. Root cause on
investigation: the test file it wrote was a hand-condensed single-line
version of the plan's test code, with a syntax error (mismatched parens) —
this can never pass regardless of implementation, and read like an
environment hang rather than a code defect. `npm install` and `jest` both
ran in under 40s once given the correct file. This is a recurring Codex
failure mode, not a one-off — worth checking first whenever Codex reports a
stuck/hanging red-test step.

**How to apply:** In handoff instructions to Codex (or similar coding
agents), state plainly: "copy the plan's code blocks verbatim, do not
retype or condense them." If Codex later reports a hang/stall during a
red-test step, check the actual test file content against the plan before
assuming an environment issue (TLS, network, install) — a syntax error
masquerading as a hang is cheap to rule out and easy to miss.
