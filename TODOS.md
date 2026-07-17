# TODOS

Backlog of open work. Source of truth for "what's outstanding" — context/rationale lives in memory (linked per item). Update at session end when scope changes; retro reads this for Backlog Health.

## Open

- [ ] **xberg native build-out** (low priority) — `toolforge-pdf` plugin ran on a mock stub (`xberg-mock.exe`) that returned placeholder text regardless of input; swapped to real `pdf-parse` text-layer extraction 2026-07-16. Still open: OCR fallback for scanned/image PDFs (needs page-rasterization — `canvas`/native build tooling on Windows or a WASM-only path), and whether to compile a standalone cross-language binary if reused outside Node. Deferred until real need surfaces (e.g. scanned document in the CIC ingestion pipeline, or commercial research-business reuse outside this repo). See `memory/decision-xberg-real-extraction-2026-07-16.md`.
- [ ] **Wave D full conformance gate** — code-level PASS only. Needs provisioned PostgreSQL 15+, `npm run migrate`, live E2E rerun (5 scenarios), live load test (assert p99 <200ms on list/search/trending/ratings), trending scheduler install verified. Blocked on infra (no PG in this dev environment; ad-hoc local PG rejected as fake-prod-signal). Tier 1 decision 2026-07-14. See `memory/wave-d-full-gate-requirement.md`.
- [ ] **CHANGELOG/VERSION staleness watch** — bump at phase/gate boundaries, not per-commit. Last gap: 198 commits unlogged before 07-14 backfill. Check staleness at next phase close. See `memory/changelog_discipline_gap.md`.
- [ ] **TorqueQuery reconciliation** (needs Tier 1 decision) — no owning charter since Ashfall split (2026-07-10). 3 uncoordinated implementations found: `cic/torquequery` (empty scaffold), `cic-ingestion/services/torquequery` (memory-search), `rewrite-docs/castironforge/torque-query` (doc-KB RAG). Charter drafted with 3 options, none executed pending approval. See `docs/meta/phases/torquequery-reconciliation-charter.md`.
- [ ] **TorqueQuery hardening follow-up bugs** (2026-07-17) — pre-decision hardening pushed clean: `rewrite-docs` main `456da15`, `cic-ingestion` master `519bc7e4`. 3 real bugs surfaced, none fixed yet (out of scope for hardening pass): (1) memory-search fast-path is not actually deterministic under the real client call pattern — `TorqueQueryClient.ts` always supplies `normalized_embedding`, which skips the `hash(text)`-seeded RNG entirely; original 2026-07-02 canary "APPROVED" verdict was reading a vacuous zero-count harness run, not a real pass — see `cic-ingestion/src/services/torquequery/CANARY-VERIFICATION-2026-07-17.md`; (2) doc-RAG `/ingest` smoke test hit malformed YAML frontmatter in `docs/00-EIGHT-ITEM-BUILD-PLAN.md` (shared docs tree); (3) `validate_fs_read` treats `limit=0` as falsy and silently defaults instead of rejecting. See both `HARDENING-NOTES.md` files and [[finding-torquequery-fastpath-nondeterminism-2026-07-17]].
- [x] **bun installed** (2026-07-17) — `npm install -g bun` → v1.3.14 at `C:\Users\soren\AppData\Roaming\npm\bun.cmd`. Already on persistent user PATH; needs fresh shell session to pick up (this session's PATH was cached pre-install). Once picked up, verify `bun run gen:skill-docs` works and re-sync the `gstack-upgrade` `SKILL.md.tmpl`/rendered `SKILL.md` pair that was hand-edited in lockstep while bun was unavailable — check they haven't drifted.

## Process (recurring, not one-shot)

- [x] **Push discipline** — Stop hook (`~/.claude/hooks/check-push-discipline.js`) now auto-checks c:\dev, cic-ingestion, CIC submodule for unpushed commits every session end. Live 2026-07-15. See `memory/feedback_push_discipline_hook.md`.
- [ ] **Session continuity notes** — multi-drop sessions (hour+ gaps between commits) should end each drop's commit message with a one-line "next: X" pointer. No tooling enforces this yet — manual discipline only. See `memory/session_continuity_gap.md`.

## Log

- 2026-07-15: File created. Backlog had been memory-only since 07-12; flagged twice in retro (07-12, 07-15) as a recurring gap. Decision: create real file instead of deferring again.
- 2026-07-17: Dedicated backlog pass (file hadn't shrunk in 2 retros). Closed 1 item: "uncommitted files at repo root" — confirmed committed in `3e39dd0`, no longer stale. 4 items remain open, all genuinely blocked (infra, low-priority deferral, or unresolved tooling gap) — not neglect, no false closures forced.
