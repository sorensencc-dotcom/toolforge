---
name: feedback-regression-tag-convention
description: "Adopt test(qa): / test: prefix for regression/coverage commits to sharpen retro Test Health section"
metadata: 
  node_type: memory
  type: feedback
  originSessionId: 1d68638d-4b8e-4798-82c3-aa1e218ff89b
  modified: 2026-08-12T03:03:50.308Z
---

Tag regression/QA-coverage commits with `test(qa):` or `test:` prefix, same spirit as [[feedback_commit_test_tag_convention]].

**Why:** Retro 2026-08-11 found no regression-tag convention in use that window — not a real gap (8 test commits landed anyway) but the missing tag makes future retros' Test Health section fuzzier than it needs to be.

**How to apply:** When a commit's primary purpose is regression/QA coverage, prefix `test(qa):` (or plain `test:` per existing convention) even if it touches non-test files.
