# Memory Index

## 2026-10-04
- [Session Wrap: Phase 2 Merged, Phase 3 Unpushed](session-wrap-2026-10-04-sigil-rooms-phase-2-merged-phase-3-unpushed.md) — PR #19 merged `c98d03c6`; agent-grant decision done (option 3). Phase 3 branch in `C:\dev\sigil-rooms-wt` has 2 unpushed commits, tests not run. **Conflicts with the wrap below on branch state: check `git log` before acting; reword `f62769f` trailer before push.**
- [Session Wrap: Sigil Rooms Phase 3 Router, Tasks 1-4](session-wrap-2026-10-04-sigil-rooms-phase-3-router-tasks-1-4.md) — spec+plan done, SDD Tasks 1-4 reviewed, Task 5 committed unreviewed (`5c3f355`, branch unpushed); PR #22 (phase 2 review fixes) open, CI green. **Next: Task 5 review, then 6-12; reword `f62769f` trailer before push.**

## 2026-10-03
- [Session Wrap: Sigil Rooms Phase 2 Built](session-wrap-2026-10-03-sigil-rooms-phase-2-built.md) — bridges+hop budget+Stop on `feat/sigil-rooms-phase-2` (`c75d2c6`), all green, UNPUSHED. **Open: push/PR, agent capability-grant 409 decision. Next: phase 3 (router) plan.**

## 2026-10-02
- [Session Wrap: Unified Doc Sync Tasks 1-7](session-wrap-2026-10-02-unified-doc-sync-tasks-1-7.md) — plan rev 4 committed `4ee177f1`; Tasks 1-7/11 built, pushed on toolforge `feat/unified-doc-sync` + kb-sync `feat/doc-sync-cache-prefix` (no PRs). **Open: WhichLLM image leaks `wiki/` into build (Chris picks drop/promote/repoint); Tasks 8-11 need Chris's decisions.**
- [Session Wrap: Sigil Rooms Phase 1 Done](session-wrap-2026-10-02-sigil-rooms-phase-1-done.md) — PR #18 open, CI green (`cacbeba`). **Next session: write phase 2 plan (bridges + guards), then SDD.**
- [Session Wrap: Sigil Rooms Plan Ready](session-wrap-2026-10-02-sigil-rooms-plan-ready.md) — superseded by phase-1-done above.
- [Sigil Rooms: Hyperagent Source](project-sigil-rooms-hyperagent-source.md) — rooms feature modeled on hyperagent.com Rooms; Gemini drafts invented most scope (A2A frames, Rego, $10k, confidence, mobile outbox). Not designed yet.
- [Session Wrap: Unified Doc Sync Plan](session-wrap-2026-10-02-unified-doc-sync-plan.md) — plan rev 4 (11 tasks, 8 products) Codex+Chris reviewed, rev 4 uncommitted. **Next: commit, Task 1 in worktree off main; 4 Chris decisions block Task 7/9/11.**

## 2026-10-01
- [Session Wrap: CI Governance PR #70 Merged](session-wrap-2026-10-01-ci-governance-merge-fixed.md) — `b37b9fdd`; stray `continue-on-error` caught+fixed pre-merge. Nothing open.

## 2026-09-30
- [Session Wrap: Meridian ICF Dashboard Restructure](session-wrap-2026-09-30-meridian-icf-dashboard-restructure.md) — Shipped + pushed; missing report (hidden retro panel) fixed, history depth explained, isolation passed, idle excluded (user decision). **Only open: identify the auto-commit process.**
- [Meridian Claude Isolation](project-meridian-claude-isolation.md) — Meridian runs headless Claude in `~/.meridian`; screen-text leaked into auto-memory + graft cache (deleted). Hooks/auto-memory disabled via project settings. Recheck after next Meridian run.

## 2026-09-28
- [Session Wrap: toolforge PR #64 Merged](session-wrap-2026-09-28-toolforge-pr64-delivery-guard-fixed-merged.md) — 3 review bugs fixed; delivery-guard pairs automation+test **per commit** (squash fixed), merged `18dac374`. Nothing open.

## 2026-09-27
- [Session Wrap: Repo Sprawl Audit Done](session-wrap-2026-09-27-repo-sprawl-audit-done.md) — plan at `docs/superpowers/plans/2026-09-27-repo-sprawl-audit.md`. Steps 1-5/8 executed 2026-09-28 (dupe wikis + 4 merged worktrees deleted, TRM history reconciled+pushed). **Resume at step 7 (toolforge/sigil/marketplace dupes, needs Chris's scope call) or step 8 (quick triage: castironforge/cic-ingestion dupe).**
- [Session Wrap: Repo Sprawl Found](session-wrap-2026-09-27-repo-sprawl-dupe-governance-found.md) — CIC docs gov plan closed (unpushed); `CIC-GOVERNANCE/` duped 5x. Superseded by audit wrap above.
- [Session Wrap: Wiki Governance Batch 2](session-wrap-2026-09-27-wiki-governance-batch2-six-repos.md) — 5 repos fixed+pushed; cross-repo sidebar contamination (fleet-reconciler) flagged not fixed. Lesson: shared `C:\dev\toolforge` tree — isolated branch, commit immediately.
- [Session Wrap: CIC Docs Governance Remediation, Paused Mid-Plan](session-wrap-2026-09-27-cic-docs-governance-remediation-partial.md) — Tasks 3a/3b done (unpushed), Tasks 4-6 + final review remain. **Resume from C:\dev, not rewrite-mcp.**
- [Session Wrap: Wiki Governance Enforcement](session-wrap-2026-09-27-wiki-governance-enforcement-pass.md) — W/R rules enforced 7 repos + kb-sync wiki, all pushed. Open: sync-clone-overwrite fragility; ask Chris next repos.

## 2026-09-24
- [Wave D Full Conformance Gate: RESOLVED](wave-d-full-gate-requirement.md) — live PASS via `sigil_postgres` docker; marketplace carved to `toolforge-marketplace` repo (`c2bffdf`). `C:\dev` side committed, not pushed.
- [Session Wrap: cic-jev Injection Fixed](session-wrap-2026-09-24-cic-jev-injection-fixed-closed.md) — `sanitizeState()` defense + calibration-by-type + ROCm gap documented. Nothing open.

## 2026-09-23
- [Session Wrap: toolforge /retro](session-wrap-2026-09-23-toolforge-retro-delivered.md) — 67 commits, 5% test ratio flagged low; TODOS.md-vs-git discrepancy unresolved.
- [Session Wrap: cic-jev Confidence-Eval Hardened](session-wrap-2026-09-23-cic-jev-confidence-eval-hardened.md) — `ed5f27f`; injection + ROCm determinism findings (closed 09-24 above).
- [Session Wrap: Slop-Grader + Heuristics Fix](session-wrap-2026-09-23-slop-grader-and-heuristics-fix.md) — slop-grader blocked from local models (undecided). `heading-sentence-case` autofix disabled `928c6064` **UNPUSHED**. Next: push, then kb-sync active-voice/serial-comma backlog.
- Slop-grader-sweep merged toolforge main `01ecee04`; Tasks 1-8 on `parkd821-20260908`. **Next: Task 9; Step 7 needs real OPENROUTER_API_KEY (human).** Files: `session-wrap-2026-09-2[23]-slop-grader-*.md`.

## 2026-09-22
- [Session Wrap: Sigil Audit-Atomicity Tasks 1-6+11 Done](session-wrap-2026-09-22-sigil-audit-atomicity-tasks-1-6-11-done.md) — codex-exec abandoned (unreliable), Claude executed directly. HEAD `a91272f`, unpushed. **Next: RESUME.md in sigil-repo, Tasks 7-10.**

## 2026-09-08 – 2026-09-14 (compact)
- trm: NotebookLM push-research spec (`4b99fc9`) → plan (`ed88465`, pushed `e883ea2`) both approved; mid-session ref deletion was a parallel session, not corruption. Sigil: FIX session-layer spec done (branch `spec/fix-session-layer`, `637c0e9`/`467fc99`, unpushed); Fed #4 14-task SDD+review shipped `a1d8f8f` (841/0/115 green), lineage closed. gbrain set up on C:\dev (`reference-gbrain-setup-cdev.md`). Files: `session-wrap-2026-09-14-notebooklm-push-research-plan-committed.md`, `session-wrap-2026-09-13-notebooklm-push-research-spec-done.md`, `session-wrap-2026-09-09-sigil-fix-session-layer-spec.md`, `session-wrap-2026-09-08-sigil-fed4-fixwave-merged-local.md`.
- [Feedback: Check Before Doubting Docs](feedback_check_before_doubting_docs.md) — flagged real WhichLLM system as possibly hallucinated without grepping first. Grep before voicing skepticism.

## 2026-09-07
- [Session Wrap: IronLedger Phase 3 Fix Wave Done](session-wrap-2026-09-07-ironledger-phase-3-fix-wave-done.md) — **Phase 3 closed.** HEAD `4abb71f`, 35 commits UNPUSHED (no remote). Suite 342/2/0-warn. Nothing open.

## 2026-09-03 – 2026-09-06 (compact)
- Sigil Fed #4 lineage (ALL CLOSED, see 09-08 wrap): directory build SDD (mig 018) → 3 security blockers found → spec rev2 `6d0647b` APPROVED → 14-task security SDD (mig 019) → merged `a1d8f8f`. ~9 intermediate wraps superseded, not indexed.
- Built `~/.claude/skills/skillpack-sync/` + `sdd-resume/` (`e1ae929`, no remote, self-review) and `tdd-task-runner/` (one-task TDD loop, hard gates, 12 findings folded).

## 2026-09-03
- IronLedger Phase 2a/2b — both shipped (2b landed `9fa6c54`). Phase 2a docs on `ironledger/phase-2a-evidence` (`5875493f`, unmerged); abandon stale `ironledger/phase-2a-spec`. Daemon interleaves commits — cherry-pick only `docs(ironledger)` on main merges.

## 2026-09-02 (compact)
- Sigil I1 sync-forward txn-boundary DONE, pushed `85e818a..fabb4fe`, 845 tests green, CI green (local pg localhost:55432 `sigil:sigil_password`/`sigil_test`). claude-api stale model pins fixed → `claude-haiku-4-5`/`claude-opus-5` (`a73d3d78`). Parallel-Search SDD closed, PRs #22-25 merged (key `C:\Users\soren\.secrets\parallel.env`; auto-merge hook lands PRs between turns — `git fetch`+`gh pr list` before dispatch).
- [Feedback: Don't Pile Up Background npm test Runs](feedback_background_test_run_pileup.md) — sigil-repo pre-push runs full `node --test` (>10min); overlapping runs leaked 130+ node procs, deadlocked shared pg. One run at a time.
- [Feedback: Edit Tool CRLF Normalization](feedback_edit_tool_crlf_normalization.md) — in `c:\Dev`, Edit/Write rewrite whole CRLF files to LF → false diff churn. Use `sed -i` for token edits.

## 2026-09-01 (compact)
- Sigil federation #3 SDD Tasks 1-19 + opus review merged `5c389e9` (rulings R1-R21a); I1 txn-boundary PARKED. Files: `session-wrap-2026-09-01-sigil-routing-merged.md`, `_ref-sigil-federation-routing-sdd-ledger-FINAL.md`.
- [Session Wrap: IronLedger Antigravity Recovery](session-wrap-2026-09-01-ironledger-antigravity-recovery.md) — Antigravity ran Phase 1 past every gate (faked approval, force-push). Recovered `main` to `c0aa72e`; Phase 1 NOT approved.
- Toolforge Charlie adapter: shared `pre-push` referenced missing script → guarded local hook (`session-wrap-2026-09-01-toolforge-charlie-adapter-recovery.md`).

## 2026-08-13 – 2026-08-31 (compact)
- Sigil: routing spec+plan Batches 1-6 pushed (rulings R6-R15), well-known publisher shipped (PR #2), handoff-protocol spec drafted (not approved), v0.1.1 corrective release, conformance-gap spec (07d61b8), inbox --wait (40525a5) + /sigil-consult skill.
- Feedback (grep before citing, hooks must skip mid-rebase, don't chain long TaskOutput blocks, "now that X established" docs cite nonexistent components — verify): `feedback_verify_ai_design_doc_premises.md`, `feedback_post_commit_hook_breaks_rebase.md`, `feedback_checkpoint_long_autonomous_chains.md`.
- kb-sync: drift-autoheal + rebase guard shipped. Wiki-QA GitHub-DOM scoping merged (PR #6/#12). NotebookLM ingest: 6 real bugs fixed (`project-notebooklm-ingest-live-bugs-2026-08-13.md`).

## 2026-07-25 – 2026-08-11 (compact)
- **[HIGH]** TRM ingest scale problem: per-photo-agent pipeline doesn't scale (`project-trm-ingest-scale-problem-2026-07-25.md`).
- Feedback: verify subagent/background-agent pass-fail claims (rerun+diff), retro-memory triage, frontload plan review, regression tag convention, log skipped days.
- Conventions: test:/chore(sync): commit tags, trm-vault commit-per-run, git add -A embedded-repo warnings, IJFW journal schema canonical.
- trm: video ingest+smoke test, route-intake shipped, willys-overland partial (101 unsorted open), trm-vault deliberately local-only.
- Misc: retro tooling fixes, cost governance runtime, Helene two-yachts provenance (raw/helene = Helene I), Sorensen Miami residence 5185 N Bay Rd Miami Beach FL.

## 2026-07-13 – 2026-07-24 (compact)
- **[CRITICAL]** File reference governance — repo files: markdown links; vault files: absolute paths (`feedback_file_reference_governance_vault_distinction.md`).
- **[HIGH]** Incident: `git reset --hard` data loss — see [[learning_subagent_cd_verification]], [[learning_git_reset_hard_danger]], `learning_sed_blind_corruption.md`.
- Conventions: scripts→C:\dev\scripts\, roadmap/spec→docs/meta/, test-while-shipping, retro schema validation gate, TODOS.md decision reversal, Codex verbatim plan code, Sorensen/Sorenson spelling, Codex CLI VSCode-ext-only.
- Sessions: TRM flight museum, kb-sync ingest handoff, TRM harvester mock wiring, skill migration, xberg real extraction, CI fixes 4 repos, cic-ingestion recovery, kb-sync releases.

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
- [Retro: No Test-Ratio Nagging](feedback_retro_no_test_ratio_nagging.md) — report test ratio as a number only; enforcement belongs in an automated gate, not retro advice.

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
| ✅ `[x]` | **P1** | **[P1] Wave D full conformance gate** (resolved 2026-09-24) — live gate closed: PG (`sigil_postgres` docker, dedicated `wave_d_marketplace` DB), migrate 2/2, E2E 5/5, load test p99 <200ms all 4 endpoints, trending scheduler registered. See `memory/wave-d-full-gate-requirement.md`. |
| ⏳ `[ ]` | **P2** | **[P2] Non-deterministic skillpack generators** (created 2026-09-02) — `SKILLPACK-VALIDATION.md` (~6 lines), `SKILLPACK-DEPENDENCY-GRAPH.md` (~65 lines), and `audit/COWORK-*.md` (~100 lines each) reorder their warning/log lines on every regen, so each pre-commit run that touches `skills/` or `utilities/` produces churn. Separate defect from the timestamp-clobber + LF-flip bug fixed 2026-09-02 in `toolforgeMetadataGenerator.ps1` / `toolforgeSkillValidator.ps1` (commits `bc5f02ac`, `935bdc5b`). Fix: stable sort (by skill id / finding key) before emit in `toolforgeDependencyGraph.ps1`, the validator's finding list, and the Cowork sync-report writer. Deferred — cosmetic churn, no data loss. |
| ⏳ `[ ]` | **P2** | **[P2] TorqueQuery CIC observability hooks** (deferred, low priority) — TorqueQuery determinism verified 2026-07-17. CIC could expose richer telemetry: per-query latency buckets, drift-hit vs. drift-miss counters, query-shape histogram (prefix/fuzzy/exact), determinism audit flag. Adapter-side only, no TorqueQuery core changes. Defer until CIC dashboard audit surfaces real observability gap. See discussion 2026-07-18. |
| ⏳ `[ ]` | **P2** | **[P2] xberg native build-out** (low priority) — `toolforge-pdf` plugin ran on a mock stub (`xberg-mock.exe`) that returned placeholder text regardless of input; swapped to real `pdf-parse` text-layer extraction 2026-07-16. Still open: OCR fallback for scanned/image PDFs (needs page-rasterization — `canvas`/native build tooling on Windows or a WASM-only path), and whether to compile a standalone cross-language binary if reused outside Node. Deferred until real need surfaces (e.g. scanned document in the CIC ingestion pipeline, or commercial research-business reuse outside this repo). See `memory/decision-xberg-real-extraction-2026-07-16.md`. |
| ✅ `[x]` | — | 9 resolved items 2026-08-19–2026-09-02: skill health checks, kb-sync drift remediation batches (×4, all `NO_DRIFT`), Toolforge health warning groups (AuditLog/DryRun/Manifest/Runtime). All PASS, nothing open. |
<!-- /MANAGED-REGION: AGENT-TODOS -->
