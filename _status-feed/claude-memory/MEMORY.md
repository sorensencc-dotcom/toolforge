# Memory Index

## 2026-08-17
- [Project: Multi-Agent Handoff Protocol Spec](project-multi-agent-handoff-protocol-spec-2026-08-17.md) — governance doc closing recurring unreviewed-squash pattern; 4 review rounds converged, two-gate ratification model, drafted not committed/not Tier-1-approved.
- [Project: Sigil v0.1.1 Corrective Release](project-sigil-v0.1.1-corrective-release-2026-08-17.md) — audited unreviewed 5a86f23 squash, fixed 3 real bugs (receipt ID mismatch, heartbeat off-by-one, wait-for-receipt race) + closed coverage gaps, verified live vs Postgres, shipped v0.1.1, tags now match HEAD.
- [Feedback: Codex Scope Creep + Autopush (sigil-repo)](feedback_codex_scope_creep_autopush_sigil.md) — updated: recurrence confirmed, squashed unreviewed commits keep landing on main; needs PR-per-task gate or dedicated audit budget.

## 2026-08-16
- [Session Wrap: Sigil Conformance Gap Spec](session-wrap-2026-08-16-sigil-conformance-spec.md) — §18 audit + design spec, 4 review rounds (Codex+human), 0 open items, pushed (07d61b8). writing-plans next session.
- [Feedback: Sigil Relay State + Mailbox Ambiguity](feedback_sigil_relay_state_and_mailbox_ambiguity.md) — in-memory relay loses state on restart; empty inbox is ambiguous, ask for ledger confirmation not resend loops. Also: sigil-repo is canonical checkout, not sigil.
- [Session Wrap: Sigil inbox --wait Shipped](session-wrap-2026-08-16-sigil-inbox-wait-shipped.md) — designed, built, live-proven round trip, /sigil-consult skill built, all pushed (40525a5).

## 2026-08-15
- [Project: Sigil Consult-Skill Backlog](project-sigil-consult-skill-backlog-2026-08-15.md) — user wants a skill wrapping "send context to Sigil peer, read reply" instead of manual send/inbox; deferred, depends on inbox --wait landing.
- [Project: Sigil npm Packaging Decision](project-sigil-npm-packaging-decision-2026-08-15.md) — bin/sigil.mjs (connector) kept alongside relay CLI; next feature = env-aware auto-switch local vs remote.
- [Feedback: Codex Scope Creep + Autopush (sigil-repo)](feedback_codex_scope_creep_autopush_sigil.md) — Codex extends scope past dispatched task, auto-pushes to real origin/main; check full commit range, not just the stated commit.

## 2026-08-14
- [Feedback: Checkpoint Long Autonomous Chains](feedback_checkpoint_long_autonomous_chains.md) — don't chain repeated long TaskOutput blocks (use ScheduleWakeup instead) or run large-blast-radius multi-step work unattended past initial scope approval; checkpoint mid-chain.

## 2026-08-13
- [Project: NotebookLM Ingest Live Bugs](project-notebooklm-ingest-live-bugs-2026-08-13.md) — 6 real bugs found+fixed (MAX_PATH, double-prefix, extract dedup, dependency-map collision, git-bash path mangling, 16GB unbounded staging-dir growth); sweep closed, backlog cleared 2026-08-14.

## 2026-08-11
- [Feedback: Retro-Memory Triage Lesson](feedback_retro_memory_triage_lesson.md) — check existing memory before saving retro output as new; ask when scope ambiguous; prevents duplicate/fragmented drift.
- [Feedback: Frontload Plan Review](feedback_frontload_plan_review.md) — run /plan-eng-review before first plan commit, not after 8 revisions; stop at 3rd same-sitting revision and review.
- [Feedback: Regression Tag Convention](feedback_regression_tag_convention.md) — tag QA/regression commits test(qa): / test: to sharpen retro Test Health.
- [Feedback: Log Skipped Days](feedback_log_skipped_days.md) — note reason for a skipped workday in commit or ~/.gstack/retro-context.md.

## 2026-08-09
- [Learning: Sync Hook Fail-Fast + Session Search](learning-sync-hook-fail-fast-and-session-search-2026-07-31.md) — backfilled from 2026-07-31 retro, never reached memory before this audit.
- [Learning: Plan Code Not Exempt, File-Structure First](learning-plan-code-not-exempt-file-structure-first-2026-08-03.md) — backfilled from 2026-08-03 retro; review plan-embedded code fresh, map file structure before locking task boundaries.
- [Learning: Auto-Resolve Health Warnings Keeps TODOS Synced](learning-auto-resolve-health-warnings-todos-sync-2026-08-08.md) — backfilled from 2026-08-08 retro.

## 2026-08-08
- [Project: trm Video Ingest Shipped](project-trm-video-ingest-shipped-2026-08-08.md) — 12-task SDD build merged+pushed (d51f381); temp-dir race + repo-wide jest timeout also fixed. 6 hardening follow-ups deferred to new session, incl. zero real-binary validation (highest-value gap).
- [Project: trm Video Smoke Test Shipped](project-trm-video-smoke-test-2026-08-08.md) — follow-up #5 closed: real-binary smoke test vs mocked ffmpeg/ffprobe/whisper.cpp, pushed 7e21551. Caught+fixed own git-add sweeping unrelated staged file mid-session. 5 follow-ups still open.

## 2026-08-06
- [Project: Retro Tooling Fixes](project-2026-08-06-retro-tooling-fixes.md) — loc-filtered.ps1 auto-excludes chore(sync) commits now; TODOS.md split Open/Completed + creation-date stamp convention added.

## 2026-08-05
- [Project: trm route-intake Shipped](project-trm-route-intake-shipped-2026-08-05.md) — topic classification for triage-intake output, merged+pushed; willys-overland topic node still needs creating before --apply.
- [Project: trm willys-overland Partial](project-trm-willys-overland-partial-2026-08-05.md) — topic created+ingested+extracted+committed (986dac0); score/report, cuba/helene staging, 101 unsorted files still open. `trm create` path is relative to topics/, not prefixed.

## 2026-08-02
- [Project: trm-vault Deliberately Local-Only](project-trm-vault-deliberately-local-only.md) — pre-push hook hard-blocks any remote by design; don't bypass on a bare "push trm-vault" request, resurface context first.
- [Project: 4 Uncaptured Fix Commits (2026-08-01)](project-2026-08-01-uncaptured-fix-commits.md) — retro-schema patch, lineage-lock concurrency, cost-spec gaps, torquequery routing gaps; memory was 3 days stale, caught by weekly audit.

## 2026-08-01
- [Project: Helene Two Yachts, Mark Sprang Provenance](project-helene-two-yachts-mark-sprang-provenance.md) — Sorensen owned 2 yachts named Helene (Defoe 1927 vs BIW 1931); raw/helene image batch = Helene I, from BGSU archivist Mark Sprang.
- [Project: Cost Governance Runtime (Antigravity Build)](project-cost-governance-runtime-antigravity-build.md) — Antigravity building runtime against CIC-AI-AGENT-COST-SPEC-001 + TorqueQuery policy; verify claims independently against spec text.

## 2026-07-31
- [Session Wrap: Test Coverage Expansion](session-wrap-2026-07-31-test-coverage-expansion.md) — trm-vault/cic-ingestion/kb-sync, 6 commits pushed, 2 real pre-existing bugs fixed, 1 backlog item opened.
- [Feedback: Verify Subagent Test Reports](feedback_verify_subagent_test_reports.md) — Codex/Antigravity pass/fail claims were wrong multiple rounds; always rerun tests + diff independently before committing.

## 2026-07-30
- [Feedback: trm-vault Commit Per Run](feedback_trm_vault_commit_per_run.md) — commit trm-vault after every ingest/dedup run, not batched; 227-file exposure gap found 2026-07-30.

## 2026-07-29
- [Session Wrap: sync-treatment Shipped](session-wrap-2026-07-29-sync-treatment-shipped.md) — 10-task SDD execution, 5 tasks hit real bugs in plan's own reference code (caught by per-task review); real vault run found benson-ford dup facts + missing michigan-flight-museum extract.
- [Project: Sorensen Miami Residence Confirmed](project-charles-sorensen-miami-residence-benson-ford.md) — 5185 N Bay Rd, Miami Beach FL 33140; corrects trm-feedback-report skill's hedged candidates to known-fact status.
- [Feedback: Commit test: Tag Convention](feedback_commit_test_tag_convention.md) — test-primary commits get test: prefix even if touching non-test files.
- [Feedback: Commit chore(sync): Tag Convention](feedback_commit_chore_sync_tag.md) — bulk/automated resync commits tagged distinctly so retro tooling can filter LOC noise.
- [Project: Micro-Session Fragmentation Watch](project-micro-session-fragmentation-watch-2026-07-29.md) — 18/23 sessions <20min; watch next retro whether it's benign or attention fragmenting.

## 2026-07-28
- [Session Wrap: Sync-Treatment Plan Ready](session-wrap-2026-07-28-sync-treatment-plan-ready.md) — spec + implementation plan committed, execution deferred; plan at docs/superpowers/plans/2026-07-28-trm-sync-treatment.md.
- [Finding: TRM FCT ids not stable](finding-trm-fct-ids-not-stable-2026-07-28.md) — extract.json ids renumbered positionally every regen; fixed with content-hash factKey.
- [Session Wrap: Benson Ford Closed + Retro](session-wrap-2026-07-28-benson-ford-close.md) — 256/256 real-ingested; retro flags rediscovery tax + invisible OCR latency; 3 backlog items opened.

## 2026-07-27
- [Project: Benson Ford Batch1 Closed](project-benson-ford-batch1-closed-2026-07-27.md) — 14/15 real Vision OCR ingest; fixed trm --dir flag + metadata schema + no-dotenv silent-mock trap.
- [Project: OCR Endpoint Live, Benson Ford Next](project-trm-ocr-endpoint-live-benson-ford-next-2026-07-27.md) — built + live-verified /api/analyze/ocr against real Google Vision; 5 gaps left before real run.
- [Finding: cic-ingestion Autocommit/Push Daemon](finding-cic-ingestion-autocommit-push-daemon-2026-07-27.md) — session edits landed on origin/master with no git command from me; mechanism unconfirmed, check git status before assuming nothing's pushed.

## 2026-07-26
- [Feedback: Check git add -A Embedded Repo Warnings](feedback_check_git_add_a_embedded_repo_warnings.md) — 3 broken gitlinks found in one sweep; check add-A output, don't just trust git status.
- [Finding: Secret-Scan sk- False Positive](finding-secret-scan-sk-false-positive-2026-07-26.md) — pre-commit hook blocked any word ending "sk"+hyphen; fixed with word-boundary anchor.
- [Finding: ijfw fts5 Missing Dep Fixed](finding-ijfw-fts5-missing-dep-fixed-2026-07-26.md) — better-sqlite3 missing 6+ wks, silently broke tier-promotion behind `failed=0`; installed, verified.
- [Project: cic-ingestion Token Baseline](project-cic-ingestion-token-baseline-2026-07-26.md) — baseline.json (10% flag threshold) after 415% uncontrolled token/cost growth in one session.
- [Decision: IJFW Journal Schema Canonical](decision-ijfw-journal-schema-canonical-2026-07-26.md) — `schema:1`/session-end wins over `ijfw-schema:v1`; cic-os journal migrated.
- [Finding: Journal/Handoff Staleness](finding-journal-handoff-staleness-2026-07-26.md) — cic-os journal 31d stale + cic-ingestion handoff unclosed, both fixed.

## 2026-07-25
- [Project: cic-ingestion TS Health](project-cic-ingestion-tsc-health-2026-07-25.md) — 138 pre-existing tsc errors dispatched to Codex, unverified. Not one fix.
- [Session Handoff: MFM Closed, Benson Ford Next](session-handoff-2026-07-25-mfm-closed-benson-ford-next.md) — MFM ingest fully closed; Benson Ford next, needs architecture rethink first.
- **[Feedback: Check Background Agents For Hangs](feedback_check_background_agents_for_hangs.md)** — poll TaskOutput proactively (2x sibling duration) instead of passively waiting.
- **[HIGH] [Project: TRM Ingest Scale Problem](project-trm-ingest-scale-problem-2026-07-25.md)** — per-photo-agent pipeline doesn't scale to thousands; real architecture pass needed, not more parallel agents.

## 2026-07-19 – 2026-07-24
- [Project: TRM Flight Museum + Benson Ford Ingest Pending](project-trm-flight-museum-benson-ford-ingest-pending-2026-07-24.md) — hundreds of photos/doc-photos/transcripts to ingest; no raw-intake script yet.
- [Project: Pre-flight Underlying Scripts Broken](project-preflight-underlying-scripts-broken-2026-07-23.md) + **[CRITICAL] [Feedback: File Reference Governance — Vault Distinction](feedback_file_reference_governance_vault_distinction.md)** — repo files need markdown links, vault files (trm-vault) absolute paths only; pattern repeated, damaged trust.
- [Drift: CIC Vision Design Omission](drift_2026-07-22_cic_vision_design_omission.md) / [kb-sync Ingest Handoff](project-kb-sync-ingest-handoff-2026-07-22.md) — verify CIC design conformance before ship; kb-sync .env fixed, 88 files pending manual ingest.
- [Feedback: Test While Shipping](feedback_test_while_shipping_discipline.md) — 1 integration test per commit keeps ratio >10%.
- [Governance: Retro Schema Validation Gate](governance_retro_schema_validation_gate.md) — pre-commit hook validates .context/retros/*.json schema.
- [Policy: Scripts Governance](policy_scripts_governance.md) — all scripts → C:\dev\scripts\.
- [Feedback: Governance Roadmap Location](feedback_governance_roadmap-location.md) — roadmaps → docs/meta/, not root.

## 2026-07-16 – 2026-07-18
- [Session Wrap: TRM Harvester Mock Wiring](session-wrap-2026-07-18-trm-harvester-mock-wiring.md) — harvester claim mostly false (verified); shipped via brainstorm→spec→plan→SDD.
- [Session Wrap: Skill Migration (Complete + Wave A)](session-wrap-2026-07-18-skill-migration-complete.md) — 34 skills migrated to Operator Guide template, 43% boilerplate cut.
- [Session Wrap: TRM Reporting + Ingest](session-wrap-2026-07-18-trm-reporting-and-ingest.md) — reporting engine v1 merged, Willow Run ingested (20 facts).
- [Learning: Codex CLI Location](learning-codex-cli-location.md) — codex.exe at `~/.codex/.sandbox-bin/`; `claude` CLI doesn't exist on this machine (VSCode extension only).
- **[HIGH] [Incident: git reset --hard Data Loss](incident_git_reset_data_loss_2026-07-16.md)** — subagent committed to main, containment reset --hard destroyed all uncommitted work, no backup. See [[learning_subagent_cd_verification]], [[learning_git_reset_hard_danger]].
- [Learning: Sed Blind Corruption](learning_sed_blind_corruption.md) — repo-wide sed for reference-fixing corrupts plan docs; exclude control docs upfront.
- [Feedback: Sorensen/Sorenson Spelling](feedback_sorensen_sorenson_spelling.md) — search both spellings of Charles E. Sorensen, commonly misspelled in period records.
- [Decision: xberg Real Extraction](decision-xberg-real-extraction-2026-07-16.md) — toolforge-pdf plugin called mock stub; swapped to real pdf-parse extraction.
- [Feedback: Codex Verbatim Plan Code](feedback_codex_verbatim_plan_code.md) — tell Codex to copy plan code blocks verbatim; condensed rewrites cause silent syntax bugs.
- [Drift: Spec Location](drift-2026-07-16-spec-location.md) — specs go in `docs/meta/`, not skill-default `docs/superpowers/specs/`.
- [Session Wrap: CI Fixes 4 Repos](session-wrap-2026-07-16-ci-fixes-4-repos.md) — 3/4 repos fixed from real job-log root causes; rewrite-docs blocked on SUBMODULE_PAT auth.

## 2026-07-13 – 2026-07-15
- [Session Wrap: Reconciliation + cic-ingestion Recovery](session-wrap-2026-07-15-cic-ingestion-recovery.md) — main→master rebase, 18 lost source files reconstructed, tests 230→443/449.
- [TODOS.md Decision Reversal](feedback_todos_md_decision.md) — real backlog file created after recurring twice as retro gap; supersedes memory-only tracking.
- [Session Wrap: KB-Sync Releases](session-wrap-2026-07-13-kb-sync-releases.md) — v1.2–v1.7, 20+ features; v1.5 design drift caught and fixed.

## 2026-07-12 and earlier
- [CIC Documentary Treatment Framework](cic-documentary-treatment-framework.md) — Framework Spec v1 + Draft Skeleton v1 locked.
- [Retrospective: Governance v2.0 Rewrite](session-retro-2026-07-12-governance-simplification.md) — v1.5→v2.0, 359→158 lines, principle-driven.
- [Drift Analysis & Enhancements](drift-analysis-2026-07-12-comprehensive.md) — 6 incidents analyzed, DRIFT-005 fixed, 7 process enhancements.
- [Embedded Workflow Checklists](workflow-checklists-embedded.md) — pre-action checklists for Artifact/Write/Governance, active since 2026-07-12.

## System Governance & Architecture
- [Global Operating Rules v2.0](../docs/meta/global-operating-rules-cic-rewrite-labs.md) — 5 principles, 3-tier authority, 3-class taxonomy, conformance gate.
- [Governance Activation Pattern](governance-activation-pattern.md) — 7-stage deployment model, proven on 27+ phases.

## Current Work
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

## Archive (2026-07-02 through 2026-07-11)
- Phase 27 (Waves A–G): 200+ tests PASS. Phase 26 ASHFALL: Docker E2E 97.5% PASS.
- Phase 3–5 KB Consolidation: 50+ link fixes. Phase 4: Wave A+B shipped. Phase 2b: v1.2.0 tagged, 60/64 tests PASS.
- gstack Skill Ecosystem Audit: 23 skills, 4 with tests; Phase 8 backfill now complete.

## Open Process Gaps (flagged, not urgent)
- [Changelog Discipline Gap](changelog_discipline_gap.md) — CHANGELOG/VERSION go stale; bump at phase boundaries.
- [Session Continuity Gap](session_continuity_gap.md) — multi-drop sessions need "next: X" linking notes between hour+ gaps.
- [gstack Telemetry Coverage Gap](feedback_gstack_telemetry_coverage_gap.md) — bun toolchain unavailable; blocks skill-doc regen.

## References
- [Artifact Versions Manifest](../docs/meta/artifact-versions-manifest.md) — published artifacts index, Tier 1 approved.
- [CIC Roadmap](master-roadmap-location.md) — CIC_MASTER_ROADMAP.md is source of truth.
