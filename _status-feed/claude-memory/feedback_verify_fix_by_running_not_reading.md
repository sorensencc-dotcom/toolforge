---
name: feedback_verify_fix_by_running_not_reading
description: "Before shipping a fix in a system with hidden regeneration/side-effect logic, run the actual code path, not just read it — a fix that looks correct from the file alone can be silently self-undoing"
metadata: 
  node_type: memory
  type: feedback
  originSessionId: e4e14930-d8e9-4be4-ad89-e2a1859a4645
---

Verify a fix by actually running the code path it touches, not by reading
the file and reasoning that it should work — especially in systems with
codegen, regeneration, or side-effecting state.

**Why:** 2026-07-17, `toolforge/post_seal_ops/sealed_store/seal-789.bin`
was tripping the security scanner's FS-BINARY rule. It looked like a
naming accident (content was literal text). Renamed it to `.txt`, staged
the fix, then ran a "sanity check" test invocation of the workflow that
owns it — and watched it regenerate `seal-789.bin` on the spot, because
`publish_artifact.py:7` hardcodes a `.bin` extension for every sealed
artifact by design. The same sanity-check run also mutated several
untracked append-only state files (`event_log.json`, `lineage_lock.json`,
`registry.json`, `promotion_freeze.json`). Caught before pushing only
because the fix was actually exercised, not just inspected — a plausible,
reasoned-through rename would have shipped, silently regenerated the
"fixed" file on the next real run, and reopened the exact bug it claimed
to close.

**How to apply:** When a fix touches a file that any code path writes to
(caches, generated artifacts, lockfiles, state logs, sealed/immutable
stores), grep for every write-reference to that literal path before
trusting a rename/edit as done — then actually invoke the writing code
path once to confirm the fix survives it. If the invocation has real side
effects (mutates tracked/append-only state), revert cleanly afterward
rather than leaving test-run byproducts in the working tree. See
[[learning-two-skill-trees]] for the sibling lesson from the same session
(same principle, applied to "which of two file copies does the runtime
actually load").
