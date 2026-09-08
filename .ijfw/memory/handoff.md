Handoff: 2026-09-08
====================
Status
------
| Runtime owner Phase A | T01-T06 complete | T07 deferred to Phase B |
Linux-first internal Toolforge supervisor is committed; production selection and cross-repo publishing stay disabled.
Decisions
---------
- Use `modules/runtime-owner/` with Linux polling, PGID lifecycle, group CPU/RSS sampling, and no automatic restart.
- Require argv arrays, environment allowlists, durable PID/PGID records, atomic state writes, and monotonic event sequences.
- Defer T07; consumer checkout and reproducible Open Notebook CI fixture are not present.
Modified Files
--------------
- `modules/runtime-owner/*`: contracts, supervisor, limits, PGID signaling, orphan cleanup, logs, tests.
- `package.json`: `test:runtime-owner` command.
- `integration-harness/T07-README.md`: Phase B consumer handoff.
- Design spec, `STATUS.md`, and `.ijfw/memory/plan.md` updated.
Next Steps
----------
1. Review Phase A commits and preserve unrelated review artifacts.
2. Run `npm run test:runtime-owner` with a hard 60-second timeout; use WSL2 for Linux evidence.
3. Obtain signed Phase B authority, consumer checkout, and pinned Open Notebook fixture before T07.
4. Do not push or enable production substrate selection without explicit authorization.
Blockers
--------
- T07 requires `toolforge-herdr-trm-integration`, absent from this checkout.
- `gstack`/`gstack-retro` executable is unavailable; retro automation was not run.
- Existing review files remain dirty and unstaged: `docs/meta/reviews/*`.
Commits
-------
`98b451c6`, `03b2ee2d`, `552fd48a`, `d9125a0a`, `082ec316`, `25357345`.
