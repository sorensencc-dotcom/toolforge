Handoff: 2026-08-25
====================

Status
------
| Phase 1 | Wave NA | Step 1 | in-progress |

TorqueQuery hybrid dispatch implementation is on branch `codex/torqquery-hybrid-agent-dispatch` in `C:\dev\.worktrees\torqquery-hybrid-agent-dispatch`. Core implementation and hardening are committed; focused dispatch suite is 21/21 passing. Estimated 75% complete.

Decisions
---------
- Sigil Ed25519 + RFC8785 JCS is cryptographic boundary; verifier CLI is standalone and official `sigil verify-contract` is wired.
- Zero-cost routes only; max 3 sequential attempts; operator override must stay signed/allowlisted.
- OpenRouter key resolves from `OPENROUTER_API_KEY`; Ollama URL resolves from env/default and local-host allowlist.
- No live provider smoke test without explicit provider, cost, prompt, and operator approval.

Modified Files
--------------
- `tools/agent-dispatch/`: contracts, verifier/preflight, three adapters, dispatcher, results/trace, 21 tests.
- `src/providers/index.js`: removed stray `l}`; commit `599cc9f`.
- Sigil worktree `C:\dev\.worktrees\sigil-contract-verifier`: verifier CLI and tests; commits `e49804d`, `a0348d`.
- Design/plan docs remain untracked under `docs/superpowers/{specs,plans}/`.

Next Steps
----------
1. Add and run the missing explicit worktree-containment regression test; current implementation exists in `dispatcher.py`.
2. Finish result schema: contract hash, operator identity, termination reason, artifact paths.
3. Update stale string-signature example in design spec.
4. Restore/create `.ijfw/index/files.md`, then rerun `npm run pre-flight` index validation.
5. Review generated untracked `cic-vision-governance/artifacts/threshold/v106-v115.json`; preserve unless ownership confirms cleanup.
6. Final scoped diff/security review; do not merge/push yet.

Blockers
--------
- Full pre-flight reaches `index:validate` but stops because `.ijfw/index/files.md` is absent.
- Live smoke requires explicit operator approval and real provider choice; no credentials were used.