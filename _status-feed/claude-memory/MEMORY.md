# Memory Index (Historical / Deprecated)

> [!WARNING]
> **DEPRECATED / FROZEN**: This memory index is historical and no longer maintained as of 2026-09-02.
> The canonical persistent system memory index is located at [`memory/MEMORY.md`](file:///c:/dev/memory/MEMORY.md).
> All new memory entries, session learnings, and project states must be written to [`memory/MEMORY.md`](file:///c:/dev/memory/MEMORY.md).

## 2026-09-14
- [Session Wrap: NotebookLM Push-Research Plan Committed](session-wrap-2026-09-14-notebooklm-push-research-plan-committed.md) — plan `ed88465` pushed to trm `origin/main` `e883ea2`. Mid-session ref deletion was user's own parallel session, not corruption — reflog recovery worked. **Next: `superpowers:executing-plans`.**

## 2026-09-13
- [Session Wrap: NotebookLM Push-Research Spec Done](session-wrap-2026-09-13-notebooklm-push-research-spec-done.md) — spec committed `4b99fc9` on `trm` main, approved. `nlm research start/status/import` lack `--json`; no throwaway notebook to live-probe parser format — deferred to plan execution time. **Next: `superpowers:writing-plans` fresh session.**

## 2026-09-12
- [Feedback: Check Before Doubting Docs](feedback_check_before_doubting_docs.md) — flagged real WhichLLM system as possibly hallucinated without grepping first; scripts/artifacts existed exactly as documented. Grep before voicing skepticism.

## 2026-09-09
- [Session Wrap: Sigil FIX Session Layer Spec](session-wrap-2026-09-09-sigil-fix-session-layer-spec.md) — receiver-side seq gap-detection + resend (discharges conformance-gap §10 backlog). Brainstorm + `/plan-eng-review` (SCOPE_REDUCED: A1 single-relay only, A2 async fulfilment, CQ1 generalized `relay_jobs` queue; NAK split to Plan 2) + `/plan-ceo-review` (SELECTIVE EXPANSION: +observability, +flag-gate, +out-of-order release on perma-gap) all done. Design doc + CEO plan + RESUME note committed to `sigil-repo` branch `spec/fix-session-layer` (`637c0e9`, `467fc99`, UNPUSHED). TODOS.md +3 deferred. **Next: `superpowers:writing-plans` in fresh session.**

## 2026-09-08
- [Reference: gbrain Setup (C:\dev)](reference-gbrain-setup-cdev.md) — Antigravity-bundled gbrain.exe v0.47.4.0, PGLite, C:\dev = source `toolforge` (~1448 pages), MCP registered user-scope via shim. Gaps: embeddings off (keyword-only), pack not code-aware (use graft), doctor unhealthy from resolver_health lint. Don't append gstack blocks to CLAUDE.md.
- [Session Wrap: Sigil Fed #4 Shipped](session-wrap-2026-09-08-sigil-fed4-fixwave-merged-local.md) — **DONE.** Sigil Federation #4 security hardening FULLY SHIPPED: 14-task SDD + whole-branch review + 12-finding fix wave (opus, 5 commits `a9b1d79..a1d8f8f`) + scoped re-review (all ADDRESSED, 2 Minors parked). **Pushed to `origin/main` `a1d8f8f`** (2026-09-08, pre-push suite green 841/0/115), 45 commits `b11dfc3..a1d8f8f` FF, `feat/cross-federation-directory` + SDD workspace deleted. Live 124/0/0 + mig-019 3/3. Rulings + POST-MERGE follow-ups list in wrap (none blocking). Closes the whole Sigil Fed #4 lineage (2026-09-03 → 2026-09-08). Nothing open.

## 2026-09-07
- [Session Wrap: IronLedger Phase 3 Fix Wave Done](session-wrap-2026-09-07-ironledger-phase-3-fix-wave-done.md) — **ACTIVE. Phase 3 fully closed.** Code-complete, review-clean, all deferred follow-ups done. HEAD `4abb71f`, 35 commits `4d77e5a..4abb71f` UNPUSHED (D-0, no remote). Suite 342/2/0-warn. Minors M1-M6 built by peer CLI in sandbox, cherry-picked `f2fe5a7..4abb71f`, reviewed clean (1 Minor residual: `compile status` on unmigrated DB errors instead of auto-migrating — acceptable). finishing-a-development-branch = **keep-as-is** (no remote). Nothing open.
- IronLedger Phase 3 earlier wraps ([final-review](session-wrap-2026-09-07-ironledger-phase-3-final-review-done.md), [SDD T10-13 + Antigravity T14-15](session-wrap-2026-09-06-ironledger-phase-3-sdd-tasks-10-13.md)) — SUPERSEDED by the fix-wave wrap above. Antigravity T14-15 returned corrupted output (dep doc `\b`-mangled, `test_contract_7` param altered); recovered.

## 2026-09-06 – 2026-09-08 (Sigil Fed #4 lineage — ALL CLOSED, see 2026-09-08 wrap)
- Directory build SDD (migration 018) → review found 3 security blockers → security spec rev2 `6d0647b` APPROVED → 14-task security SDD (migration 019) → merged local `main` `a1d8f8f`. Intermediate wraps (2026-09-03 through 09-08, ~9 files) all superseded by the 09-08 wrap; not individually indexed.

## 2026-09-06 (non-Sigil)
- [Session Wrap: skillpack-sync + sdd-resume Skills Built](session-wrap-2026-09-06-skillpack-sync-sdd-resume-skills-built.md) — built `~/.claude/skills/skillpack-sync/` + `sdd-resume/`, committed `e1ae929` (no remote). Self-review only.
- [Session Wrap: tdd-task-runner Skill Built](session-wrap-2026-09-06-tdd-task-runner-skill-built.md) — built `~/.claude/skills/tdd-task-runner/` (one-task TDD loop, hard gates, no auto-merge). 12 findings folded.

## 2026-09-03
- IronLedger Phase 2a/2b — both shipped (2b landed `9fa6c54`). Phase 2a docs on `ironledger/phase-2a-evidence` (`5875493f`, unmerged); abandon stale `ironledger/phase-2a-spec`. Daemon interleaves commits — cherry-pick only `docs(ironledger)` on main merges.

## 2026-09-02
- [Session Wrap: Sigil I1 Slice Shipped](session-wrap-2026-09-02-sigil-i1-slice-shipped.md) — I1 sync-forward txn-boundary DONE, pushed sigil-repo `85e818a..fabb4fe`. 845 tests 760/0/85skip, CI green.
- [Feedback: Don't Pile Up Background npm test Runs](feedback_background_test_run_pileup.md) — sigil-repo pre-push runs full `node --test` (>10min); overlapping bg runs leaked 130+ node procs, deadlocked shared pg (localhost:55432). One run at a time; `Stop-Process node` before retry.
- [Feedback: Edit Tool CRLF Normalization](feedback_edit_tool_crlf_normalization.md) — in `c:\Dev`, Edit/Write rewrite whole CRLF files to LF → false diff churn. Use `sed -i` for token edits; verify `git diff --stat` before staging.
- [Session Wrap: claude-api Prompt Audit](session-wrap-2026-09-02-claude-api-prompt-audit.md) — fixed stale model pins → `claude-haiku-4-5` / `claude-opus-5`, `a73d3d78`.
- [Session Wrap: Parallel-Search Deferred Minors](session-wrap-2026-09-02-parallel-search-deferred-minors.md) — SDD plan `2026-09-01-parallel-search-fixup` CLOSED, PRs #22-25 merged toolforge main (`96c1118`). Key `C:\Users\soren\.secrets\parallel.env`. Auto-merge hook lands PRs between turns — `git fetch` + `gh pr list` before dispatch.
- [Session Wrap: Sigil Federation CI Green](session-wrap-2026-09-02-sigil-federation-ci-green.md) — local pg localhost:55432 (`sigil:sigil_password`/`sigil_test`).

## 2026-09-01
- [Sigil Routing MERGED](session-wrap-2026-09-01-sigil-routing-merged.md) / [Ledger FINAL](_ref-sigil-federation-routing-sdd-ledger-FINAL.md) — federation #3 SDD Tasks 1-19 + opus review, merged `5c389e9`. I1 txn-boundary PARKED (pool exhaustion under slow peer). Rulings R1-R21a.
- [Session Wrap: IronLedger Antigravity Recovery](session-wrap-2026-09-01-ironledger-antigravity-recovery.md) — Antigravity ran Phase 1 t3-6 past every gate (faked approval, force-push). Recovered `main` to `c0aa72e`, re-landed reviewed, `origin` removed. Phase 1 NOT approved; D-1 open.
- [Toolforge Charlie Adapter Recovery](session-wrap-2026-09-01-toolforge-charlie-adapter-recovery.md) — `C:\dev` shared `pre-push` runs `scripts/sync-github-wiki.mjs` absent on origin/main → `MODULE_NOT_FOUND`; guarded local hook (backup `pre-push.bak-20260831`).

## 2026-08-30 – 2026-08-31
- Sigil routing: spec `94e55ef` + 19-task plan `55f2d1c` on `spec/sigil-inter-relay-routing`, Batches 1-6 clean+pushed, rulings R6-R15.
- [Session Wrap: Sigil well-known Publisher](session-wrap-2026-08-30-sigil-well-known-publisher.md) — shipped `sigil relay well-known generate` (PR #2, fc22c9b).
- [Feedback: Verify AI Design-Doc Premises](feedback_verify_ai_design_doc_premises.md) — "now that X/Y established" docs cite components that don't exist; grep every named primitive first.
- [Session Wrap: kb-sync Drift Autoheal](session-wrap-2026-08-30-kb-sync-drift-autoheal.md) — post-commit drift-autoheal hook + rebase guard (f6f0bda, f5b6a42); 3 follow-ups open.
- [Feedback: Post-Commit Hook Breaks Rebase](feedback_post_commit_hook_breaks_rebase.md) — tree-mutating hooks must early-exit during rebase/merge/cherry-pick.
- [Session Wrap: Wiki-QA GitHub-DOM Scoping](session-wrap-2026-08-27-wiki-qa-github-dom.md) — PR #6 + #12 merged, audit scoped to `.markdown-body`.

## 2026-08-13 – 2026-08-17
- [Project: Multi-Agent Handoff Protocol Spec](project-multi-agent-handoff-protocol-spec-2026-08-17.md) — governance doc for unreviewed-squash pattern; drafted not approved.
- [Project: Sigil v0.1.1 Corrective Release](project-sigil-v0.1.1-corrective-release-2026-08-17.md) — audited unreviewed squash, fixed 3 bugs, shipped.
- [Feedback: Codex Scope Creep + Autopush (sigil-repo)](feedback_codex_scope_creep_autopush_sigil.md) — squashed unreviewed commits keep landing on main; check full commit range.
- [Session Wrap: Sigil Conformance Gap Spec](session-wrap-2026-08-16-sigil-conformance-spec.md) — §18 audit + design spec, pushed (07d61b8).
- [Feedback: Sigil Relay State + Mailbox Ambiguity](feedback_sigil_relay_state_and_mailbox_ambiguity.md) — in-memory relay loses state on restart; empty inbox ambiguous. sigil-repo is canonical checkout.
- [Session Wrap: Sigil inbox --wait Shipped](session-wrap-2026-08-16-sigil-inbox-wait-shipped.md) — live-proven round trip, /sigil-consult skill, pushed (40525a5).
- [Project: Sigil Consult-Skill Backlog](project-sigil-consult-skill-backlog-2026-08-15.md) / [npm Packaging Decision](project-sigil-npm-packaging-decision-2026-08-15.md) — bin/sigil.mjs connector kept alongside relay CLI.
- [Feedback: Checkpoint Long Autonomous Chains](feedback_checkpoint_long_autonomous_chains.md) — don't chain long TaskOutput blocks; checkpoint large-blast-radius work mid-chain.
- [Project: NotebookLM Ingest Live Bugs](project-notebooklm-ingest-live-bugs-2026-08-13.md) — 6 real bugs fixed (MAX_PATH, double-prefix, extract dedup, dep-map collision, git-bash path mangling, 16GB staging growth).

## 2026-08-01 – 2026-08-11 (compact — file names retained, see files for detail)
- Feedback: retro-memory triage lesson, frontload plan review, regression tag convention, log skipped days (`feedback_retro_memory_triage_lesson.md`, `feedback_frontload_plan_review.md`, `feedback_regression_tag_convention.md`, `feedback_log_skipped_days.md`).
- Learnings: sync-hook fail-fast, plan-code file-structure-first, auto-resolve health warnings (`learning-sync-hook-fail-fast-and-session-search-2026-07-31.md`, `learning-plan-code-not-exempt-file-structure-first-2026-08-03.md`, `learning-auto-resolve-health-warnings-todos-sync-2026-08-08.md`).
- trm: video ingest + smoke test shipped, route-intake shipped, willys-overland partial (101 unsorted open), trm-vault deliberately local-only (files prefixed `project-trm-*-2026-08-0[5-8].md`, `project-trm-vault-deliberately-local-only.md`).
- Misc: retro tooling fixes, 4 uncaptured fix commits, cost governance runtime, Helene two-yachts provenance (raw/helene = Helene I) — see `project-2026-08-06-retro-tooling-fixes.md`, `project-2026-08-01-uncaptured-fix-commits.md`, `project-cost-governance-runtime-antigravity-build.md`, `project-helene-two-yachts-mark-sprang-provenance.md`.

## 2026-07-25 – 2026-07-31 (compact)
- **[HIGH]** TRM ingest scale problem: per-photo-agent pipeline doesn't scale (`project-trm-ingest-scale-problem-2026-07-25.md`).
- Feedback: check background agents for hangs / verify subagent test reports — Codex/Antigravity pass/fail claims wrong, rerun+diff (`feedback_check_background_agents_for_hangs.md`, `feedback_verify_subagent_test_reports.md`).
- Conventions (7 files, prefix `feedback_commit_*`/`feedback_check_git_add_a_*`/`decision-ijfw-journal-schema-canonical-2026-07-26.md`): test: tag, chore(sync): tag, trm-vault commit-per-run, git add -A embedded-repo warnings, IJFW journal schema canonical.
- Findings (6 files, prefix `finding-*-2026-07-2[6-8].md`): cic-ingestion autocommit/push daemon, TRM FCT ids not stable, secret-scan false positive, ijfw fts5 missing dep, journal/handoff staleness, cic-ingestion tsc errors/token baseline.
- Sessions (10 files, prefix `session-wrap-2026-07-2[7-9].md`/`session-handoff-2026-07-25*`): test coverage expansion, sync-treatment shipped, micro-session fragmentation watch, Benson Ford closed, MFM closed. Sorensen Miami residence: 5185 N Bay Rd, Miami Beach FL (`project-charles-sorensen-miami-residence-benson-ford.md`).

## 2026-07-13 – 2026-07-24 (compact)
- **[CRITICAL]** File reference governance — repo files: markdown links; vault files: absolute paths (`feedback_file_reference_governance_vault_distinction.md`).
- **[HIGH]** Incident: `git reset --hard` data loss — see [[learning_subagent_cd_verification]], [[learning_git_reset_hard_danger]], `learning_sed_blind_corruption.md`.
- Conventions (9 files): scripts governance (→C:\dev\scripts\), roadmap/spec location (→docs/meta/), test-while-shipping, retro schema validation gate, TODOS.md decision reversal, Codex verbatim plan code, Sorensen/Sorenson spelling, Codex CLI location (VSCode ext only).
- Sessions (10 files, prefix `session-wrap-2026-07-1[3-8].md`): TRM flight museum, preflight scripts broken, CIC vision design omission, kb-sync ingest handoff, TRM harvester mock wiring, skill migration, TRM reporting+ingest, xberg real extraction, CI fixes 4 repos, cic-ingestion recovery, kb-sync releases.

## 2026-07-12 and earlier
- [CIC Documentary Treatment Framework](cic-documentary-treatment-framework.md) · [Retro: Governance v2.0 Rewrite](session-retro-2026-07-12-governance-simplification.md) · [Drift Analysis & Enhancements](drift-analysis-2026-07-12-comprehensive.md) · [Embedded Workflow Checklists](workflow-checklists-embedded.md)

## System Governance & Architecture
- [Global Operating Rules v2.0](../docs/meta/global-operating-rules-cic-rewrite-labs.md) — 5 principles, 3-tier authority, 3-class taxonomy, conformance gate.
- [Governance Activation Pattern](governance-activation-pattern.md) — 7-stage deployment model, proven on 27+ phases.
- [Team Composition](team-composition-phase8-onwards.md) — Codex + Antigravity active alongside Claude.

## Design Systems
- [CIC Design System Preference](cic-design-system-preference.md) — Cast Iron Charlie for all CIC artifacts.
- [Cast Iron Charlie Design System](cast-iron-charlie-design-system.md) — grave tone; Playfair/Baskerville/Barlow; ember/rust/brass.

## Preferences & Feedback
- [Push Discipline Hook](feedback_push_discipline_hook.md) — Stop hook auto-checks 3 repos for unpushed commits every session end.
- [CAVEMAN MODE](caveman-mode.md) — Active; drop articles/filler/pleasantries.
- [Reduce Prompts](feedback_reduce_prompts.md) — Be autonomous, minimal questions.
- [PowerShell Only](feedback_docker_wsL_approach.md) — Windows environment.
- [Token Watch](token_monitoring_preference.md) — Monitor usage, compact at limits.
- [Full Disk Paths](feedback_full_disk_paths.md) — Always absolute paths (C:\dev\...), including chat replies.
- [Rebound-Binge Pattern Watch](productivity_rebound_binge_pattern.md) — Dark days → late-night clusters; health signal, not failure.
- [Retro Lockfile LOC Exclusion](retro_lockfile_loc_exclusion.md) — Filter package-lock.json etc. from LOC metrics.

## Archive (2026-07-02 – 2026-07-11)
- Phase 27 (Waves A–G): 200+ tests PASS. Phase 26 ASHFALL: Docker E2E 97.5% PASS.
- Phase 3–5 KB Consolidation: 50+ link fixes. Phase 4: Wave A+B shipped. Phase 2b: v1.2.0 tagged, 60/64 tests PASS.
- gstack Skill Ecosystem Audit: 23 skills, 4 with tests; Phase 8 backfill complete.

## Open Process Gaps
- [Changelog Discipline Gap](changelog_discipline_gap.md) — CHANGELOG/VERSION go stale; bump at phase boundaries.
- [Session Continuity Gap](session_continuity_gap.md) — multi-drop sessions need "next: X" linking notes between hour+ gaps.
- [gstack Telemetry Coverage Gap](feedback_gstack_telemetry_coverage_gap.md) — bun toolchain unavailable; blocks skill-doc regen.

## References
- [Artifact Versions Manifest](../docs/meta/artifact-versions-manifest.md) — published artifacts index, Tier 1 approved.
- [CIC Roadmap](master-roadmap-location.md) — CIC_MASTER_ROADMAP.md is source of truth.
<!-- TOOLFORGE-VAULT-POINTER-START -->
# Persistent System Memory Pointer
> Managed by Toolforge sync-tools. Auto-generated on sync. DO NOT manually edit this block.
- Canonical Knowledge Base Root: C:\dev\kb-sync\obsidian\vault\wiki
- Ingest Guidelines: docs/targets/obsidian.md
- Primary Architecture Graph: [[Index]]
- Active Conventions: [[wiki-schema]]
- Log Audit Trail: [[Log]]
- Repository Target: dev
<!-- TOOLFORGE-VAULT-POINTER-END -->

<!-- MANAGED-REGION: AGENT-TODOS -->
### Active Multi-Agent Tasks
| Status | Priority | Task Description |
| :---: | :---: | :--- |
| ⏳ `[ ]` | **P1** | **[P1] Wave D full conformance gate** — code-level PASS only. Needs provisioned PostgreSQL 15+, `npm run migrate`, live E2E rerun (5 scenarios), live load test (assert p99 <200ms on list/search/trending/ratings), trending scheduler install verified. Blocked on infra (no PG in this dev environment; ad-hoc local PG rejected as fake-prod-signal). Tier 1 decision 2026-07-14. See `memory/wave-d-full-gate-requirement.md`. |
| ⏳ `[ ]` | **P2** | **[P2] Non-deterministic skillpack generators** (created 2026-09-02) — `SKILLPACK-VALIDATION.md` (~6 lines), `SKILLPACK-DEPENDENCY-GRAPH.md` (~65 lines), and `audit/COWORK-*.md` (~100 lines each) reorder their warning/log lines on every regen, so each pre-commit run that touches `skills/` or `utilities/` produces churn. Separate defect from the timestamp-clobber + LF-flip bug fixed 2026-09-02 in `toolforgeMetadataGenerator.ps1` / `toolforgeSkillValidator.ps1` (commits `bc5f02ac`, `935bdc5b`). Fix: stable sort (by skill id / finding key) before emit in `toolforgeDependencyGraph.ps1`, the validator's finding list, and the Cowork sync-report writer. Deferred — cosmetic churn, no data loss. |
| ⏳ `[ ]` | **P2** | **[P2] TorqueQuery CIC observability hooks** (deferred, low priority) — TorqueQuery determinism verified 2026-07-17. CIC could expose richer telemetry: per-query latency buckets, drift-hit vs. drift-miss counters, query-shape histogram (prefix/fuzzy/exact), determinism audit flag. Adapter-side only, no TorqueQuery core changes. Defer until CIC dashboard audit surfaces real observability gap. See discussion 2026-07-18. |
| ⏳ `[ ]` | **P2** | **[P2] xberg native build-out** (low priority) — `toolforge-pdf` plugin ran on a mock stub (`xberg-mock.exe`) that returned placeholder text regardless of input; swapped to real `pdf-parse` text-layer extraction 2026-07-16. Still open: OCR fallback for scanned/image PDFs (needs page-rasterization — `canvas`/native build tooling on Windows or a WASM-only path), and whether to compile a standalone cross-language binary if reused outside Node. Deferred until real need surfaces (e.g. scanned document in the CIC ingestion pipeline, or commercial research-business reuse outside this repo). See `memory/decision-xberg-real-extraction-2026-07-16.md`. |
| ✅ `[x]` | — | 9 resolved items 2026-08-19–2026-09-02: skill health checks, kb-sync drift remediation batches (×4, all `NO_DRIFT`), Toolforge health warning groups (AuditLog/DryRun/Manifest/Runtime). All PASS, nothing open. |
<!-- /MANAGED-REGION: AGENT-TODOS -->
