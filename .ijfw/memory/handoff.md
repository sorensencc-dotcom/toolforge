Handoff: 2026-09-07
====================
Status
------
| Open Notebook substrate | Tasks 1-4 done | Task 5 blocked |
TRM contract, seam, typed contracts, and loopback adapter are committed; production selection stays disabled.
Decisions
---------
- Pin upstream `lfnovo/open-notebook` at `2d2df8a3cbb098776e56ca5ee77b9832f848228e`.
- Use `GET /health` and `POST /chat/execute`; replay is unsupported and operator-resolved.
- Use native `node:crypto` SHA-256; do not duplicate Toolforge supervision.
Modified Files
--------------
- Spec, fixtures, seam script/tests, `src/research-substrate/*`, and adapter tests.
Next Steps
----------
1. Brainstorm Toolforge managed-process ownership/API.
2. Decide CPU, memory, concurrency, timeout, and orphan-cleanup controls.
3. Add only the runtime-boundary test in `toolforge-herdr-trm-integration`.
4. Keep production selection disabled until runtime tests and signed authority pass.
Blockers
--------
- Toolforge sandbox has no managed-process owner/API; Task 5 cannot safely start.
- TypeScript compiler package is absent; focused `tsx` tests pass.
- Existing review files remain dirty and unstaged.
Commits
-------
`1323d7f6` contract; `352c29d7` seam; `4b9d78b3` contracts; `b4857787` adapter.
