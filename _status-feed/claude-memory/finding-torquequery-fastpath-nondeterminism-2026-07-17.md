---
name: finding-torquequery-fastpath-nondeterminism-2026-07-17
description: "TorqueQuery v2 memory-search server's fast-path is not actually deterministic under real call patterns; original 2026-07-02 canary approval was based on a vacuous (zero-count) harness run, not a real pass."
metadata: 
  node_type: memory
  type: project
  originSessionId: feb35b8b-3e13-4d8b-b3c2-79b5c0ac19b5
---

During pre-Tier-1 hardening of `cic-ingestion/src/services/torquequery/TorqueQueryV2Server.py` ([[project-torquequery-reconciliation-2026-07-17]]), found two things that change the risk picture on this service:

1. **The original canary "APPROVED" sign-off ([[phase-5-torquequery-v2-complete]], 2026-07-02) was reading a broken run.** The actual saved `rewrite-docs/phase-5-harness-report.json` from that date shows `docCount: 0`, `passCount: 0` everywhere — the "PASS" verdicts were trivially true on empty data, not a real validation.

2. **Fast-path is not deterministic under the real production call pattern.** `compute_embedding()`'s `hash(text)`-based RNG seed only fires when the server computes its own embedding. `TorqueQueryClient.ts` always supplies a pre-normalized `normalized_embedding`, which skips that path entirely — confirmed live: two identical fast-path requests interleaved with unrelated traffic returned different result sets. Separately, `PYTHONHASHSEED` is unset, so even the seeded path only holds within one process, not across restarts.

**Why:** Re-running the harness fresh today against live code gives a genuine 3/3 PASS in isolation — so the service isn't broken, but the specific claim "determinism verified" from the original canary never actually covered how the real client calls it.

**How to apply:** Before any Tier 1 decision that assumes this service's canary gate is settled, treat the original 2026-07-02 approval as unverified/superseded. See `src/services/torquequery/CANARY-VERIFICATION-2026-07-17.md` and `HARDENING-NOTES.md` for full detail.

**Fixed 2026-07-17** (same day, follow-up): `fast_path_search()`/`full_search()`/`compute_embedding()` now seed a local `np.random.default_rng()` via sha256 over the embedding's own bytes (or query text), instead of drawing from numpy's global RNG state or Python's per-process-randomized `hash()`. Determinism now holds for both the server-computed and caller-supplied `normalized_embedding` paths, and across process restarts. 12/12 tests pass. Pushed `cic-ingestion` master `a6db805f`. The canary gate itself is still not formally re-approved by anyone with Tier 1 authority — this fixed the underlying bug, it didn't re-run/re-sign the governance gate.
