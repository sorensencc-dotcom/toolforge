# Memory Index

## 2026-09-27
- [Session Wrap: Repo Sprawl Audit Done](session-wrap-2026-09-27-repo-sprawl-audit-done.md) — full plan at `docs/superpowers/plans/2026-09-27-repo-sprawl-audit.md`. SAFE tier ~8M+1.6G, CAUTION tier (toolforge/sigil/viking-phase3 dupes) needs Chris's call, nothing executed.
- [Session Wrap: Repo Sprawl / Dupe Governance Found, Handoff Pending](session-wrap-2026-09-27-repo-sprawl-dupe-governance-found.md) — CIC docs governance plan closed (Repo A `2d7d6fd3`, Repo B `55f9d6c`, merged locally, unpushed). Surfaced real dupe: `CIC-GOVERNANCE/` byte-identical in 5 places incl. 2 redundant nested clones of same `toolforge.git` origin. **Next session: dedicated full repo-sprawl audit + cleanup plan (recon only, no deletes without confirmation).**
- [Session Wrap: Wiki Governance Batch 2 (6 repos)](session-wrap-2026-09-27-wiki-governance-batch2-six-repos.md) — cic-ingestion, rewrite-mcp, toolforge-marketplace, icf, helix fixed and pushed; cic-jev left as stub per Chris. New brand buckets `helix` + `icf`-as-hybrid confirmed live (curl'd both dashboards). Real bugs fixed in rewrite-mcp (3 pages missing `status`, 2 misusing it for rollout-state). Cross-repo sidebar contamination confirmed in a 2nd repo (toolforge-marketplace, same fleet-reconciler root cause as kb-sync-wiki last session) — flagged, not fixed. toolforge PR #59 open (governance doc changes). **Lost first edit pass to a concurrent session's branch checkout in shared `C:\dev\toolforge` tree — redid on isolated branch, commit-immediately from then on.**
- [Session Wrap: CIC Docs Governance Remediation, Paused Mid-Plan](session-wrap-2026-09-27-cic-docs-governance-remediation-partial.md) — Tasks 3a/3b done (unpushed), Tasks 4-6 + final review remain. **Resume from C:\dev, not rewrite-mcp.**
- [Session Wrap: Wiki Governance Enforcement Pass](session-wrap-2026-09-27-wiki-governance-enforcement-pass.md) — enforced `wiki-style-and-structure.md` W/R rules across 7 repos + kb-sync wiki (fresh-cloned `C:\dev\kb-sync-wiki`). All closed and pushed (toolforge `68f5187`, sigil-wiki `566934b`, trm `a3a583e`, kb-sync-wiki `fa24e4a`; charlie-deep-research/sigil/rewrite-docs already clean pre-session; `C:\dev\wiki` confirmed correctly quarantined). PRs #56 (toolforge, brand-matrix buckets) and #11 (sigil, portable paths) merged mid-session by user/other agent, verified clean. trm W11 verified closed (`44fa390`, hex match CIC SoT). **Open: sync-clone-overwrite fragility flagged as a process gap, no next-repo list given yet — ask Chris which repos are next.**

## 2026-09-24
- [Wave D Full Conformance Gate: RESOLVED](wave-d-full-gate-requirement.md) — live gate PASS via `sigil_postgres` docker (Tier 1 revised the "no ad-hoc PG" ruling: pre-existing persistent container ≠ ad-hoc). Carved Wave D marketplace code out of `C:\dev` root (was double-duty as workspace + project manifest) into `github.com/sorensencc-dotcom/toolforge-marketplace` (pushed `c2bffdf`). Migrate 2/2, E2E 5/5, load test PASS after fixing 2 real bugs (`pg.Pool` no `max` set, load harness measuring cold-start as steady-state), trending scheduler registered. `C:\dev` side of the split committed, not pushed.
- [Session Wrap: cic-jev Injection Fixed, Closed](session-wrap-2026-09-24-cic-jev-injection-fixed-closed.md) — closes out the 09-23 cic-jev wrap. `sanitizeState()` code-level injection defense (`40246af`, verified 1/1 twice live), calibration-by-type breakdown (`b56a132`, exposed overconfidence concentrated in `choice`-type questions), both + ROCm determinism gap written into spec doc (`8dd66c4`). Nothing open.

## 2026-09-23
- [Session Wrap: toolforge /retro Delivered](session-wrap-2026-09-23-toolforge-retro-delivered.md) — 7d retro on `/c/dev`, 67 commits/26.5k net LOC/5% test ratio (flagged low)/7-day streak, snapshot `.context/retros/2026-09-23-1.json`. Surfaced unresolved TODOS.md-vs-git-history discrepancy (content dated in-window, zero commits touching it in-window). Skipped self-upgrade + skill-end telemetry (IDs lost to compaction) — disclosed, not blessed.
- [Session Wrap: cic-jev Confidence-Eval Hardened](session-wrap-2026-09-23-cic-jev-confidence-eval-hardened.md) — hardened `scripts/eval-confidence.mjs` (critical-case hard gate, real calibration correlation, determinism pin, stronger prompt fencing), pushed `origin/main` `ed5f27f`, 43/43 unit tests green. Live run exposed 2 real findings: prompt-injection case fails reproducibly (fencing alone didn't fix it), and cross-process determinism is incomplete on this box's AMD ROCm GPU even with `temperature:0, seed:42` pinned. **Next (fresh session): try `JEV_MODEL=llama3.1:8b` or `llama3.3` against the injection case; if still fails, escalate to code-level defense; write both findings into `docs/meta/spec-local-jev-engine.md` §2 item 3; `ollama serve` needs to be running first.**
- [Session Wrap: Slop-Grader Local-Model Dead End + Heuristics Autofix Bug Fixed](session-wrap-2026-09-23-slop-grader-and-heuristics-fix.md) — key rotation closed (new key in `.env` + gh secret, confirmed). slop-grader-sweep confirmed architecturally blocked from free/local models (Jev typed-probability protocol, not generic chat-completions) — undecided: pay, check TypeSafe free tier, fork a local provider, or park it. Found + fixed a real bug: `heading-sentence-case` autofix was lowercasing proper nouns (Google→google, Gemini→gemini) live against kb-sync; disabled autofix for that rule, `928c6064`, 48/48 green, **UNPUSHED on parkd821-20260908**. **Next: push/PR 928c6064, then clear kb-sync's `active-voice` (41) + `serial-comma` (11) backlog from `C:/dev/kb-sync/drift/HEURISTICS-REPORT.json`, manual-fix not scripted.**
- Slop-grader-sweep: merged to toolforge main (`01ecee04`); OpenRouter key rotated after a live-chat paste exposure; paid→free model default fix based on false premise, superseded. SDD Tasks 1-8 landed `parkd821-20260908` (`cdeaaf64`..`58a01447`); real blockers fixed along the way (wrong pkg name `@lukstei/slop-grader`, pre-commit skill-validator doc requirements, secret-scan fixture false-positive). Files: `session-wrap-2026-09-23-slop-grader-openrouter-key-and-merge.md`, `session-wrap-2026-09-22-slop-grader-sweep-tasks-1-3.md`, `session-wrap-2026-09-22-slop-grader-sweep-tasks-5-8-done.md`. **Next: Task 9 (workflow+docs), brief written; Step 7 needs real OPENROUTER_API_KEY, human-only.**

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
