# Changelog

## Version 2.111.3
Date: 2026-10-27

### Changes
- de2639c7 - Merge pull request #199 from sorensencc-dotcom/fix-vector-deletion-test-5816378410706720232 (Chris Sorensen)
- bec0086d - merge: resolve PR 199 main conflicts (Chris Sorensen)
- 7431590c - test: implement vector deletion test and basic VectorStore class (google-labs-jules[bot])

## Version 2.111.2
Date: 2026-10-27

### Changes
- c1ece039 - Merge pull request #202 from sorensencc-dotcom/performance-improve-marketplace-load-1527620147398857578 (Chris Sorensen)
- ed08c6b7 - merge: resolve PR 202 main conflicts (Chris Sorensen)
- 21038c3e - test: cover bounded marketplace seed batches (Chris Sorensen)
- 7e34fc9a - chore: keep load test dependency scope focused (Chris Sorensen)
- 66268eab - fix: chunk marketplace seed inserts (Chris Sorensen)
- a0b2b3e9 - Performance improvement: batch marketplace load DB insertions (google-labs-jules[bot])

## Version 2.111.1
Date: 2026-10-27

### Changes
- a4ab470a - Merge pull request #204 from sorensencc-dotcom/perf-optimize-load-test-seeding-14094330525025906589 (Chris Sorensen)
- 7b7f91b7 - merge: resolve PR 204 main conflicts (Chris Sorensen)
- 29501589 - test: cover bounded rating seed batches (Chris Sorensen)
- f71f0e11 - fix: chunk marketplace rating inserts (Chris Sorensen)
- f2a41c26 - Optimize database seed query for marketplace load tests (google-labs-jules[bot])

## Version 2.111.0
Date: 2026-10-25

### Changes
- edd02bb8 - Merge pull request #246 from sorensencc-dotcom/fix/mcp-playwright-package (Chris Sorensen)
- e1a77c21 - chore(sync): update project journal with session learning state (Chris Sorensen)
- 56d7f976 - feat(whichllm): integrate dynamic hardware detection and align local models to qwen2.5:1.5b (Chris Sorensen)

## Version 2.110.1
Date: 2026-10-25

### Changes
- a93bdfb3 - Merge pull request #245 from sorensencc-dotcom/audit/2026-10-25 (Chris Sorensen)
- eae94e0e - chore(audit): weekly session audit 2026-10-25 (Claude)

## Version 2.110.0
Date: 2026-10-25

### Changes
- a82d7d93 - Merge pull request #243 from sorensencc-dotcom/fix/mcp-playwright-package (Chris Sorensen)
- ce747db2 - test(governance): align token-budget-gate test with ESM hook and keep planned CI note (Chris Sorensen)
- 3519e7aa - Merge branch 'main' into fix/mcp-playwright-package (Chris Sorensen)
- 3cc780a4 - fix(grok): normalize direct CLI execution path and relax fast test timing (Chris Sorensen)
- fe8f6157 - fix(toolforge): anchor PID lookup in tasklist output and harden stale lock test cleanup (Chris Sorensen)
- 957479af - feat(toolforge): auto-recover stale AST knowledge graph locks and add ijfw project marker (Chris Sorensen)
- 23350912 - docs(report): add daily report for 2026-10-25 (Chris Sorensen)
- 6ba7fdf8 - docs(retro): add engineering retro for 2026-10-25 (Chris Sorensen)
- 74be163f - test(grok): add hook guardrail validator and test suite (Chris Sorensen)
- b3744505 - feat(pipeline): relocate CIC status pipeline to scripts (Chris Sorensen)

## Version 2.109.2
Date: 2026-10-25

### Changes
- 1afb6565 - Merge pull request #244 from sorensencc-dotcom/claude/chris-mode-review-1097cc (Chris Sorensen)
- ca975ff0 - fix(retro): allow legacy optional keys in retro schema; point ICF section at icf repo (Chris Sorensen)
- 5bd221ae - fix(governance): apply 2026-10-25 audit fixes (Chris Sorensen)
- ceaea75a - chore(slop-sweep): update drift/SLOP-REPORT.md (github-actions[bot])

## Version 2.109.1
Date: 2026-10-25

### Changes
- 6b0b2a6e - Merge pull request #242 from sorensencc-dotcom/chore/retro-2026-10-24 (Chris Sorensen)
- 20d88e75 - chore(retro): add weekly retro snapshot 2026-10-24 (Chris Sorensen)

## Version 2.109.0
Date: 2026-10-25

### Changes
- b1588217 - Merge pull request #235 from sorensencc-dotcom/fix/mcp-playwright-package (Chris Sorensen)
- 1413e87f - merge: resolve PR 235 main conflict (Chris Sorensen)
- 31c7adb7 - fix(mcp): use @playwright/mcp package name (Chris Sorensen)
- d060ba6d - docs(report): add daily report for 2026-10-24 (Chris Sorensen)
- 32cb2909 - chore(ignore): ignore evidence directory and untrack run artifacts (Chris Sorensen)
- daa82e82 - feat(verify): add verify-toolforge-marketplace skill and proof harness (Chris Sorensen)

## Version 2.108.1
Date: 2026-10-25

### Changes
- 0d1943b6 - Merge pull request #241 from sorensencc-dotcom/fix/validate-policy-tests-5630008471324137546 (Chris Sorensen)
- f519140f - Merge pull request #240 from sorensencc-dotcom/test/add-build-receipt-error-tests-17260589764327905036 (Chris Sorensen)
- 21f9aec4 - Merge pull request #239 from sorensencc-dotcom/fix-ollama-ssrf-14896612757339310300 (Chris Sorensen)
- 2a0ff57f - Merge pull request #238 from sorensencc-dotcom/fix/generalize-node-deprecation-regex-3481403695354634568 (Chris Sorensen)
- 0975e59f - 🧪 Add missing tests for validatePolicy in research-substrate (google-labs-jules[bot])
- a26a3769 - test: add error case coverage for buildReceipt (google-labs-jules[bot])
- af2b15fd - Validate OLLAMA_BASE_URL protocol to prevent SSRF (google-labs-jules[bot])
- 41b85b23 - Refactor Node.js deprecation regex to support newer versions (google-labs-jules[bot])

## Version 2.108.0
Date: 2026-10-24

### Changes
- b1ea09d3 - Merge pull request #237 from sorensencc-dotcom/chore-cic-daily-status-expanded-aggregator (Chris Sorensen)
- d4ba5a56 - Merge pull request #236 from sorensencc-dotcom/sorensencc-dotcom/trm-triage-p2-frontier_lab_verification_standard (Chris Sorensen)
- 89e4b2f2 - docs(research): rewrite ACT-04 RFC from source card (Chris Sorensen)
- 3b35e8c9 - feat(scripts): add expanded CIC daily status aggregator and regression test (Chris Sorensen)
- 0aeaab78 - Merge pull request #234 from sorensencc-dotcom/claude/festive-brahmagupta-0xjmjg (Chris Sorensen)
- cd4b0497 - docs(governance): amend marketplace spec so the commit SHA is the integrity check (v1.1) (Claude)

## Version 2.107.2
Date: 2026-10-24

### Changes
- 3d4db904 - Merge pull request #227 from sorensencc-dotcom/trm/act-toolforge-icf-batch-triage-pr-bridge-tests (Chris Sorensen)
- 0f45b47a - chore(icf): implement integration test suite for batch triage and PR staging bridge (closes #215) (Chris Sorensen)

## Version 2.107.1
Date: 2026-10-24

### Changes
- 16b3774b - Merge pull request #226 from sorensencc-dotcom/trm/act-218-link-scrubber-resilience (Chris Sorensen)
- 0943b543 - chore(core): Toolforge Suspicious Link Scrubber Resilience (closes #218) (Chris Sorensen)

## Version 2.107.0
Date: 2026-10-24

### Changes
- d3927a6f - Merge pull request #225 from sorensencc-dotcom/feat/adv-review-step6 (Chris Sorensen)
- 038a81ae - feat(review): benchmark cross-model review and wire it into pre-push (issue 191 step 6) (Chris Sorensen)
- 90e23ee3 - Merge pull request #224 from sorensencc-dotcom/docs/chris-mode-review (Chris Sorensen)
- d3bbc5c9 - docs(skills): tighten chris-mode after skill-reviewer pass (Chris Sorensen)

## Version 2.106.2
Date: 2026-10-24

### Changes
- 7cd1a3e0 - Merge pull request #223 from sorensencc-dotcom/feat/adversarial-auditor-merge (Chris Sorensen)
- 44f52bcd - test(providers): cover example server imports, health redaction, and audit route (Chris Sorensen)

## Version 2.106.1
Date: 2026-10-24

### Changes
- c68be1b7 - Merge pull request #221 from sorensencc-dotcom/feat/adversarial-auditor-merge (Chris Sorensen)
- b2e935d9 - fix(providers): correct example imports and drop endpoint from health response (Chris Sorensen)
- d542d46a - chore: drop unintended journal change (Chris Sorensen)
- 78b8deea - docs(healing): point auditor imports at the .ts module (Chris Sorensen)

## Version 2.106.0
Date: 2026-10-24

### Changes
- fde41472 - Merge pull request #222 from sorensencc-dotcom/parkd821-20260908 (Chris Sorensen)
- b8a76dd3 - Merge pull request #220 from sorensencc-dotcom/docs/chris-mode-update (Chris Sorensen)
- b9d8ee89 - docs(skills): update chris-mode with Oct 2026 working conventions (Chris Sorensen)
- f0e9506b - fix(hooks): harden block-env-edit stdin parsing (Chris Sorensen)
- 9035b50f - fix(hooks): read stdin JSON and deny via JSON for Grok compatibility (Chris Sorensen)
- dd122957 - fix(diagram-sync): ignore worktrees directory in visual parity walk (Chris Sorensen)
- eb5268f6 - docs(report): add daily report for 2026-10-23 (Chris Sorensen)
- 22218e10 - docs(report): add daily report for 2026-10-22 (Chris Sorensen)
- 8740b7f3 - docs(report): add daily report for 2026-10-21 (Chris Sorensen)
- 0d81cb67 - fix(hooks): use Windows paths in Grok Claude settings (Chris Sorensen)
- 31fea892 - feat(daemon): honor .restart-dashboard flag in daemon-healer-bot (Chris Sorensen)
- fa18e480 - fix(janitor): protect canonical daemon ports from orphan termination (Chris Sorensen)
- e92756f1 - fix(daemon): probe trm-backlog endpoint to detect stale icf checkouts (Chris Sorensen)
- 65aba6a4 - docs(report): add daily report for 2026-10-20 (Chris Sorensen)
- efe0d229 - fix(diagram-sync): isolate sibling repository and worktree directories from parity gate (Chris Sorensen)
- 8fb44bac - docs(diagram): add TRM mobile inbox triage architecture visual and manifest entry (Chris Sorensen)
- 72aa0024 - feat(trm): implement mobile inbox batch triage engine, gdoc unstranding, and pr staging bridge (Chris Sorensen)

## Version 2.105.1
Date: 2026-10-24

### Changes
- 0063cd73 - Merge pull request #219 from sorensencc-dotcom/feat/adversarial-auditor-merge (Chris Sorensen)
- f82fa907 - refactor(healing): merge adversarial auditor .js into .ts (Chris Sorensen)

## Version 2.105.0
Date: 2026-10-24

### Changes
- 4f499101 - Merge pull request #217 from sorensencc-dotcom/feat/adversarial-review-routing (Chris Sorensen)
- c0e7bf02 - ci(secret-scan): allowlist the Anthropic provider test fixture key (Chris Sorensen)
- 6bef2ff2 - fix(review): harden reviewer routing per PR 217 review (Chris Sorensen)
- 1135c0cf - refactor(review): give the shared JSON-object guard a unique name (Chris Sorensen)
- 34cbc3ca - feat(review): add reviewer prompt, runner, and toolforge review --adversarial (Chris Sorensen)
- 4d6838db - feat(review): add Anthropic reviewer provider and request timeouts (Chris Sorensen)
- 4fb6da39 - feat(review): add author-aware reviewer routing and OpenAI provider (Chris Sorensen)

## Version 2.104.0
Date: 2026-10-23

### Changes
- 24266ab2 - Merge pull request #216 from sorensencc-dotcom/feat/adversarial-review-slice1 (Chris Sorensen)
- 7bc9afa2 - fix(review): address PR 216 review feedback (Chris Sorensen)
- 02f0995b - feat(review): add over-validation circuit breaker (Chris Sorensen)
- 88266cf1 - fix(review): fail closed on any invalid finding (Chris Sorensen)
- 12b9a56a - feat(review): add adversarial review parse, rank, and validation core (Chris Sorensen)
- 13aca4d2 - docs(specs): add adversarial dual-model review spec (rev 2, Tier 1 approved) (Chris Sorensen)

## Version 2.103.7
Date: 2026-10-23

### Changes
- 3eb7fa5f - Merge pull request #212 from sorensencc-dotcom/fix/mining-data-root (Chris Sorensen)
- 768671ac - fix(mining): resolve data paths from MINING_DATA_ROOT, not the checkout (Chris Sorensen)

## Version 2.103.6
Date: 2026-10-23

### Changes
- 902ab2a0 - Merge pull request #213 from sorensencc-dotcom/fix/graft-prepush-gate (Chris Sorensen)
- ff1d5f37 - fix(hooks): make graft pre-push gate check the pushed range and fail closed (Chris Sorensen)

## Version 2.103.5
Date: 2026-10-22

### Changes
- 92402f09 - Merge pull request #211 from sorensencc-dotcom/fix/mining-dead-retry-test (Chris Sorensen)
- cf03d185 - refactor(mining): extract runPackSync, drop dead retry and legacy sync code (Chris Sorensen)

## Version 2.103.4
Date: 2026-10-22

### Changes
- 01ce987f - Merge pull request #210 from sorensencc-dotcom/fix/mining-thin-caller (Chris Sorensen)
- 789a077e - fix(mining): delegate pack sync to kb-sync replaceSinglePack with atomic quarantine and no orphan retries (Chris Sorensen)

## Version 2.103.3
Date: 2026-10-21

### Changes
- 675ca6db - Merge pull request #209 from sorensencc-dotcom/fix/token-budget-gate-test-node24 (Chris Sorensen)
- c1b386ae - test(token-budget-gate): run hook as .cjs instead of removed --experimental-default-type flag (Chris Sorensen)

## Version 2.103.2
Date: 2026-10-21

### Changes
- 3b6792b8 - Merge pull request #208 from sorensencc-dotcom/fix/mining-protect-multipart-packs (Chris Sorensen)
- 0ff47e56 - fix(mining): skip only multipart notebooks; keep single-pack syncing (Chris Sorensen)
- e797aa38 - fix(mining): never delete multipart/kb-sync-managed pack sources; upload-confirm-then-prune (Chris Sorensen)

## Version 2.103.1
Date: 2026-10-21

### Changes
- 67ef85ce - Merge pull request #207 from sorensencc-dotcom/jules-token-budget-gate-test-6147880464960928059 (Chris Sorensen)
- b62d734f - Merge pull request #206 from sorensencc-dotcom/fix-notebook-prompt-sync-coverage-3795333818641780947 (Chris Sorensen)
- f49f3329 - 🧪 Add test for token-budget-gate gracefully handling malformed JSON (google-labs-jules[bot])
- 0fe3dbc8 - 🧪 Add test coverage for notebook sync exception handling (google-labs-jules[bot])

## Version 2.103.0
Date: 2026-10-21

### Changes
- 70fef923 - Merge pull request #203 from sorensencc-dotcom/perf/optimize-blend-loop-8205037533533266870 (Chris Sorensen)
- d5400026 - Merge pull request #201 from sorensencc-dotcom/jules-test-improvement-skill-security-auditor-10741383535133071462 (Chris Sorensen)
- e688bdcf - Merge pull request #200 from sorensencc-dotcom/test-improvement/signal-strength-9460087693583168982 (Chris Sorensen)
- 309572a7 - Merge pull request #198 from sorensencc-dotcom/implement-embedding-dimension-validation-12640348215107979884 (Chris Sorensen)
- e5a2d987 - Merge pull request #197 from sorensencc-dotcom/fix/test-agent-dispatch-results-12093249204195215695 (Chris Sorensen)
- 662fe9e3 - Merge pull request #205 from sorensencc-dotcom/fix-marketplace-load-n-plus-1-13015903514712833920 (Chris Sorensen)
- b176b4df - perf(load-tests): batch inserts for faster seeding (google-labs-jules[bot])
- b98e795b - perf: optimize blend computation in recommendation service (google-labs-jules[bot])
- cfb8d4c3 - 🧪 Cover exception path in skill-security-auditor utility (google-labs-jules[bot])
- 07423ab9 - Add test for empty hits array in deriveSignalStrength (google-labs-jules[bot])
- b945ae02 - feat: implement embedding dimension validation and tests (google-labs-jules[bot])
- 53baff64 - Add tests for write_result atomic creation (google-labs-jules[bot])

## Version 2.102.1
Date: 2026-10-20

### Changes
- 9f22aa8e - Merge pull request #195 from sorensencc-dotcom/test/active-memory-ci-and-concurrency (Chris Sorensen)
- 1a3c5251 - Merge pull request #196 from sorensencc-dotcom/fix/pdf-test-isolate-plugin-registry (Chris Sorensen)
- 6295acd7 - test(pdf): isolate plugin registry from the real home directory (Chris Sorensen)
- 1120d629 - test(memory): run memory suite in npm test and cover concurrent first run (Chris Sorensen)

## Version 2.102.0
Date: 2026-10-20

### Changes
- b1c45f0e - Merge pull request #194 from sorensencc-dotcom/trm/act-01-active-memory-persistent-context (Chris Sorensen)
- 4382f855 - docs(memory): document active memory commands and injection (Chris Sorensen)
- 8eb7f3c1 - test(memory): cover persistence, encryption, prune, and injection (Chris Sorensen)
- 68b13c24 - feat(cli): add memory list, add, and prune commands (Chris Sorensen)
- a91f9c8a - feat(memory): add token-capped active memory prompt injection (Chris Sorensen)
- 73a75a65 - feat(memory): add encrypted SQLite memory store (Chris Sorensen)

## Version 2.101.2
Date: 2026-10-20

### Changes
- a65fd3e7 - Merge pull request #193 from sorensencc-dotcom/trm/act-toolforge-ci-workflow-false-exit-remediation (Chris Sorensen)
- 72143aa8 - chore(toolforge): Remediate False-Success Exit Codes and Unhandled Subshell Errors in Recurring CI Workflows (closes #186) (Chris Sorensen)

## Version 2.101.1
Date: 2026-10-20

### Changes
- a7da8054 - Merge pull request #185 from sorensencc-dotcom/chore/retro-ledger-close-rf5038 (Chris Sorensen)
- 0406e0a2 - chore(retro): close RF-5038ebd02a40 in the action ledger (Chris Sorensen)

## Version 2.101.0
Date: 2026-10-20

### Changes
- 24e35865 - Merge pull request #184 from sorensencc-dotcom:feat/retro-action-ledger (Chris Sorensen)
- 40a27ac7 - feat(retro): add the tracked action ledger (Chris Sorensen)

## Version 2.100.0
Date: 2026-10-20

### Changes
- dea478d9 - Merge pull request #183 from sorensencc-dotcom:feat/retro-consolidate-weekly (Chris Sorensen)
- d24a6365 - feat(retro): run inbox consolidator before the weekly report (Chris Sorensen)

## Version 2.99.1
Date: 2026-10-19

### Changes
- e38e8da1 - Merge pull request #182 from sorensencc-dotcom/fix/retro-fabricated-fallbacks (Chris Sorensen)
- b8707ab9 - fix(retro): derive weekly metrics from git data instead of constants (Chris Sorensen)

## Version 2.99.0
Date: 2026-10-19

### Changes
- 99abfee1 - Merge pull request #178 from sorensencc-dotcom/parkd821-20260908 (Chris Sorensen)
- cda86ae9 - feat(ecosystem): automate guide compilation and sync (Chris Sorensen)
- 1b0aac9c - docs(report): add daily report for 2026-10-19 (Chris Sorensen)
- 64170ea5 - docs(report): add weekly report for 2026-W42 (Chris Sorensen)
- 2d89c191 - Merge pull request #177 from sorensencc-dotcom/docs/status-retro-followups (Chris Sorensen)
- 39e2cc2f - docs(status): record retro governance follow-ups (Chris Sorensen)

## Version 2.98.1
Date: 2026-10-19

### Changes
- bc9be9cc - Merge pull request #176 from sorensencc-dotcom:fix/retro-placeholder-metrics (Chris Sorensen)
- f7cb22e4 - fix(retro): compute backlog from TODOS.md and drop fake focus_score (Chris Sorensen)

## Version 2.98.0
Date: 2026-10-19

### Changes
- 81ed4f6a - Merge pull request #175 from sorensencc-dotcom/feat/retro-report-actions (Chris Sorensen)
- 0b1495ab - feat(retro): publish inbox findings as weekly report actions (Chris Sorensen)

## Version 2.97.0
Date: 2026-10-19

### Changes
- 713b0998 - Merge pull request #174 from sorensencc-dotcom/feat/retro-inbox-ci (Chris Sorensen)
- 9f910146 - feat(retro): validate the retro inbox in CI, pre-commit, and nightly audit (Chris Sorensen)
- e30ed3bb - Merge pull request #173 from sorensencc-dotcom:feat/retro-consolidate-core (Chris Sorensen)
- 97389a44 - chore(retro): drop test-ratio finding RF-ee909fca39b5 (Chris Sorensen)
- 07a58071 - feat(retro): add inbox consolidator with tests (Chris Sorensen)

## Version 2.96.6
Date: 2026-10-19

### Changes
- 0d6e8b17 - Feat/retro consolidate core (#172) (Chris Sorensen)

## Version 2.96.5
Date: 2026-10-18

### Changes
- cf7876d0 - Parkd821 20260908 (#169) (Chris Sorensen)
- f07e2698 - fix(hooks): block unpaired automation changes at pre-commit (#171) (Chris Sorensen)

## Version 2.96.4
Date: 2026-10-18

### Changes
- 064df8cd - Codex/research store data first import (#167) (Chris Sorensen)

## Version 2.96.3
Date: 2026-10-18

### Changes
- a6dda643 - Merge pull request #170 from sorensencc-dotcom:chore/retro-harvest-20261018 (Chris Sorensen)
- 10e75109 - chore(retro): harvest first retro inbox entries (6 findings) (Chris Sorensen)
- b87ac2e5 - Merge pull request #168 from sorensencc-dotcom:docs/retro-policy-tier1-signed (Chris Sorensen)
- 0f53185b - docs(governance): record Tier 1 approval of retro policy (Chris Sorensen)

## Version 2.96.2
Date: 2026-10-18

### Changes
- d55764f3 - chore(retro): track 2026-10-17-2 source retro with schema v1.0 backfill (#166) (Chris Sorensen)
- 4228ca34 - chore(slop-sweep): update drift/SLOP-REPORT.md (github-actions[bot])
- 52f4b853 - Merge pull request #165 from sorensencc-dotcom/docs/retro-harvest-config-approval (Chris Sorensen)
- 4c2dd897 - docs(retro): require Tier 1 approval for harvester config changes (Chris Sorensen)

## Version 2.96.1
Date: 2026-10-18

### Changes
- e8462de5 - Merge pull request #161 from sorensencc-dotcom/fix/publish-and-parity-hardening-2026-10-17 (Chris Sorensen)
- df76ad0f - fix(docs): publish wiki over HTTPS from CI, hash PNGs in the parity gate, make hooks executable (Chris Sorensen)

## Version 2.96.0
Date: 2026-10-18

### Changes
- 4dc50119 - Merge pull request #162 from sorensencc-dotcom:feat/retro-governance (Chris Sorensen)
- 0024ff54 - feat(retro): add RELIABILITY inbox tag and map reliability recommendations (Chris Sorensen)
- c17b9a0a - chore(retro): map hygiene and architecture recommendations to PROCESS and SPEC (Chris Sorensen)
- 01210b4b - docs(retro): document the retro harvester in the inbox spec and policy (Chris Sorensen)
- 9ddc27c5 - feat(retro): harvest retro recommendations into the inbox (Chris Sorensen)
- 0573a3d7 - chore(retro): track the retro harvest directory without force-add (Chris Sorensen)
- effcbef6 - docs(retro): refresh policy prerequisites and spec example after gate fixes (Chris Sorensen)
- ca8aec47 - feat(retro): pass when the retro inbox directory is absent (Chris Sorensen)
- 8b2a1929 - test(retro): cover inbox entries in the changed retro gate (Chris Sorensen)
- 4dcc93c8 - fix(retro): track retro inbox entries without force-add (Chris Sorensen)
- 99beda31 - fix(retro): validate only dated retros in the changed retro gate (Chris Sorensen)
- e0110a07 - docs(retro): add draft retro governance policy (Chris Sorensen)
- f1da3f6d - feat(retro): add retro inbox validator (Chris Sorensen)
- d2088bfd - docs(retro): add retro inbox spec and schema (Chris Sorensen)
- 6db960c0 - Fix/harden hooks and diagram sync (#160) (Chris Sorensen)

## Version 2.95.11
Date: 2026-10-17

### Changes
- 846b6c4d - fix(hooks): track git hooks and harden diagram parity with content hashes (#159) (Chris Sorensen)

## Version 2.95.10
Date: 2026-10-17

### Changes
- d88ad86f - Parkd821 20260908 (#158) (Chris Sorensen)

## Version 2.95.9
Date: 2026-10-17

### Changes
- f023d2a1 - Parkd821 20260908 (#157) (Chris Sorensen)

## Version 2.95.8
Date: 2026-10-17

### Changes
- 006efaab - Parkd821 20260908 (#156) (Chris Sorensen)

## Version 2.95.7
Date: 2026-10-17

### Changes
- 80ef4004 - docs: capture current retro evidence to restore audit freshness (#155) (Chris Sorensen)
- 4a201348 - Parkd821 20260908 (#154) (Chris Sorensen)

## Version 2.95.6
Date: 2026-10-17

### Changes
- 6faef016 - test: pair Wave D readiness fix with executable regressions (#152) (Chris Sorensen)

## Version 2.95.5
Date: 2026-10-16

### Changes
- c35d60a3 - Optimize sequential Array.find lookups in TRM Pipeline tests (#153) (Chris Sorensen)

## Version 2.95.4
Date: 2026-10-16

### Changes
- 4b85ba2e - Fix ERESOLVE during npm install by updating @vitejs/plugin-react peer dependencies (#151) (Chris Sorensen)

## Version 2.95.3
Date: 2026-10-16

### Changes
- 0a688f98 - Parkd821 20260908 (#150) (Chris Sorensen)

## Version 2.95.2
Date: 2026-10-16

### Changes
- 30d6feab - fix(delivery-guard): stream test failure output and extend container regression timeouts (#149) (Chris Sorensen)

## Version 2.95.1
Date: 2026-10-16

### Changes
- e2267d40 - fix(trm): persist structured card fields to ledger and suppress gdoc stub issue creation (closes #143) (#148) (Chris Sorensen)
- 467671de - docs(status): record dynamic MCP tool scoping Phase 1 merge (#146) (Chris Sorensen)

## Version 2.95.0
Date: 2026-10-16

### Changes
- 750fa23e - feat(mcp-scoping): span-scoped dynamic MCP tool scoping hook (Phase 1) + design spec (#145) (Chris Sorensen)

## Version 2.94.1
Date: 2026-10-14

### Changes
- bc616bff - Parkd821 20260908 (#141) (Chris Sorensen)

## Version 2.94.0
Date: 2026-10-13

### Changes
- 33f060da - feat: complete research-store dev/UAT gates with local multimodel embeddings (#134) (Chris Sorensen)

## Version 2.93.1
Date: 2026-10-13

### Changes
- eb87619b - Parkd821 20260908 (#139) (Chris Sorensen)
- 336ec4e3 - Fix CI governance matrix workflow to populate the workspace with root workflow and hook files required by governance tests (Chris Sorensen)

## Version 2.93.0
Date: 2026-10-12

### Changes
- 055cacb - feat(fleet): integrate stateless MCP specs, TRM backlog dashboard, and NLM routing guards (#133) (Chris Sorensen)

## Version 2.92.3
Date: 2026-10-12

### Changes
- 30b1073e - test: rehearse research store dev uat recovery (#132) (Chris Sorensen)

## Version 2.92.2
Date: 2026-10-12

### Changes
- e33b8d3c - Codex/research store delivery (#131) (Chris Sorensen)

## Version 2.92.1
Date: 2026-10-12

### Changes
- ab1c1df - fix(wiki): publish repo pages on ship (#130) (Chris Sorensen)

## Version 2.92.0
Date: 2026-10-12

### Changes
- 4f1e0e3 - feat(skills): bound the kb-sync triage digest (#129) (Chris Sorensen)

## Version 2.91.0
Date: 2026-10-12

### Changes
- b936265 - feat(skills): add GitDiagram and Gitingest intake (#128) (Chris Sorensen)

## Version 2.90.1
Date: 2026-10-12

### Changes
- 6401aad - fix(trm): repair the triage diagram heading (#127) (Chris Sorensen)

## Version 2.90.0
Date: 2026-10-11

### Changes
- 1a9e471 - feat(trm): add card triage from main (#126) (Chris Sorensen)

## Version 2.89.0
Date: 2026-10-11

### Changes
- bfe91e4 - feat(trm-devops-triage): run real last30days engine in trend sweep stage (Claude)

## Version 2.88.2
Date: 2026-10-11

### Changes
- 514514e - ci: clear matrix checkout warnings (#122) (Chris Sorensen)

## Version 2.88.1
Date: 2026-10-11

### Changes
- b23bce7 - fix: restore ratified local-only Ollama routing (#118) (Chris Sorensen)
- 525df2f - chore(slop-sweep): update drift/SLOP-REPORT.md (github-actions[bot])

## Version 2.88.0
Date: 2026-10-11

### Changes
- 09eb3d1 - feat(gates): implement one-way vs. two-way door action classifier & execution gates (closes #115) (#117) (Chris Sorensen)

## Version 2.87.1
Date: 2026-10-11

### Changes
- 9303efb - Parkd821 20260908 (#113) (Chris Sorensen)

## Version 2.87.0
Date: 2026-10-11

### Changes
- 854df45 - feat(pilot): reconcile toolforge read-only pilot with security hardenings (dcd5a970) (#112) (Chris Sorensen)

## Version 2.86.1
Date: 2026-10-10

### Changes
- 8d3df92 - Parkd821 20260908 (#111) (Chris Sorensen)

## Version 2.86.0
Date: 2026-10-10

### Changes
- 739415c - feat(pr110): integrate vane research, notebooklm registry expansion, and governance hardening (#110) (#110) (Chris Sorensen)

## Version 2.85.6
Date: 2026-10-09

### Changes
- bd41406 - fix: require production database credentials and fail UI image builds (#109) (Chris Sorensen)

## Version 2.85.5
Date: 2026-10-09

### Changes
- e9cc348 - Feat/notebooklm cluster parity audit (#107) (Chris Sorensen)

## Version 2.85.4
Date: 2026-10-09

### Changes
- cae9c90 - test(ci): isolate Sigil matrix suites from copied governance tests (#108) (Chris Sorensen)
- 2a45dde - docs(status): record 10-06 docs refresh open list (#106) (Chris Sorensen)
- f6c2ffc - docs(governance): fix stale claims in documentation-policy, wiki guide, phase 7 charter (#105) (Chris Sorensen)
- d2f6eb2 - docs(utilities): drop stale $ScriptPath known-bug note, fix sync-tools path (#104) (Chris Sorensen)
- e1f3ac1 - chore(docs): delete root DOCS_INDEX.md (#103) (Chris Sorensen)

## Version 2.85.3
Date: 2026-10-06

### Changes
- 9683fb9 - fix(scheduler): point Daily Roadmap Sync at sync-tools/multiRepoRoadmapSync.cjs (#102) (Chris Sorensen)
- ead011d - docs: align daemon notes, scheduler docs, and operator guide with the repo (#100) (Chris Sorensen)
- dd889a1 - docs: correct DOCS_INDEX.md and add single-writer section to wiki-sync-registry (#99) (Chris Sorensen)
- 958349d - fix(usagecheck): satisfy canonical skill validator and security audit (#101) (Chris Sorensen)
- 15301df - docs(daemons): mark toolforge sync daemon notes as stub design (#98) (Chris Sorensen)

## Version 2.85.2
Date: 2026-10-06

### Changes
- d782c1e - fix(report): commit only the weekly report path (#97) (Chris Sorensen)
- ddf1caf - docs(meta/phase-8): note marketplace deliverables were built in a separate repo (#96) (Chris Sorensen)
- 75d664d - docs(meta/phases): add status notes to ashfall state and phase ABC audit charter (#95) (Chris Sorensen)
- bf1d4a9 - docs(meta/plans): fix moved-path references, add status notes (#94) (Chris Sorensen)
- 7e6ab26 - docs(meta/specs): note slop-grader spec layout differs from the build (#93) (Chris Sorensen)
- f1df701 - docs(meta/governance): fix dead links and add status notes (#92) (Chris Sorensen)
- 3df77e8 - docs(meta): move phase2 and docs-structure files into specs/ and plans/ (#91) (Chris Sorensen)

## Version 2.85.1
Date: 2026-10-05

### Changes
- ba3df1c - docs(report): restore weekly Markdown reports (W38-W40) + Sunday task (#90) (Chris Sorensen)

## Version 2.85.0
Date: 2026-10-05

### Changes
- 9ebd669 - feat(registry): add 8 knowledge-plane notebooks to notebooklm-registry (#89) (Chris Sorensen)
- d7602b0 - docs(meta): refresh top-level notes against current code (#88) (Chris Sorensen)

## Version 2.84.4
Date: 2026-10-05

### Changes
- 82d8afc - fix(hooks): stop pre-push from publishing the wiki (#87) (Chris Sorensen)

## Version 2.84.3
Date: 2026-10-05

### Changes
- 2bb17df - fix: wiki sync pushes only when asked (#86) (Chris Sorensen)

## Version 2.84.2
Date: 2026-10-04

### Changes
- 51a4331 - fix(retro): read the retro window as UTC in check-retro-needed (#85) (Chris Sorensen)

## Version 2.84.1
Date: 2026-10-04

### Changes
- 808242c - chore(retro): file 2026-10-04 retro, warn on stale newest retro (#84) (Chris Sorensen)

## Version 2.84.0
Date: 2026-10-04

### Changes
- bb8d827 - feat(doc-sync): registry rows and toolforge wiki link fixes (#81) (Chris Sorensen)

## Version 2.83.4
Date: 2026-10-04

### Changes
- 0c4fb76 - chore(doc-sync): ignore wiki sync receipt (#82) (Chris Sorensen)

## Version 2.83.3
Date: 2026-10-04

### Changes
- f9a0480 - test(vfs): add hybrid rrf and viking vfs benchmark suite (#83) (Chris Sorensen)

## Version 2.83.2
Date: 2026-10-04

### Changes
- 7766b9d - test(sentinel): add regression tests for kb-sentinel-bot wikilink stripping and frontmatter (#80) (Chris Sorensen)
- bae4d15 - chore(slop-sweep): update drift/SLOP-REPORT.md (github-actions[bot])

## Version 2.83.1
Date: 2026-10-03

### Changes
- d38e1d0 - fix(sentinel): strip code spans and scan workspace docs for wikilinks (#79) (Chris Sorensen)

## Version 2.83.0
Date: 2026-10-03

### Changes
- d9184e2 - Merge pull request #78 from sorensencc-dotcom/parkd821-20260908 (Chris Sorensen)
- cb79440 - feat(fleet): triage mobile ingress actions, implement Viking context compaction, and integrate DuckDB analytics (Chris Sorensen)

## Version 2.82.0
Date: 2026-10-03

### Changes
- 99d1709 - Merge pull request #77 from sorensencc-dotcom/feat/unified-doc-sync (Chris Sorensen)
- 242153d - fix(doc-sync): drop WhichLLM topology image so the build stops leaking wiki/ (Chris Sorensen)
- e865268 - fix(doc-sync): report cache load result separately from wiki status (Chris Sorensen)
- e392966 - fix(doc-sync): refuse old kb-sync cache, accept asset and spaced sidebar links (Chris Sorensen)
- cec40c3 - fix(doc-sync): build-only mode, static footer, stop publishing C:/dev/wiki (Chris Sorensen)
- 1a1e2d6 - feat(doc-sync): add docs:sync CLI with drift receipts and per-product cache load (Chris Sorensen)
- 3015105 - feat(doc-sync): publish one product from a folder or a build, mirror-only (Chris Sorensen)
- a09f1be - feat(doc-sync): fail on sidebar links to pages outside the product (Chris Sorensen)
- b7b9bba - feat(doc-sync): add mirror stager that refuses empty sources (Chris Sorensen)
- 0ec2d8e - feat(doc-sync): add validated wiki sync registry loader (Chris Sorensen)

## Version 2.81.0
Date: 2026-10-03

### Changes
- 9853e21 - Merge pull request #76 from sorensencc-dotcom/parkd821-20260908 (Chris Sorensen)
- d0ae4f6 - fix(ticket-scorer): include inlineCode values in text extraction and escape regex keywords (Chris Sorensen)
- 0339706 - feat(ticket-scorer): add public entrypoint and verify full test suite (Chris Sorensen)
- 513c8a0 - feat(ticket-scorer): implement DeterministicTicketScorer engine and rubric (Chris Sorensen)
- a5cc9ce - feat(ticket-scorer): add clause-bounded negation matcher and test suite (Chris Sorensen)
- fd0ffa5 - feat(ticket-scorer): add package scaffolding, tsconfig, and core types (Chris Sorensen)
- 6fb8f62 - docs(plan): add deterministic ticket scorer implementation plan (Chris Sorensen)
- 370a5bf - docs(spec): refine scorer options and rubric edge cases (Chris Sorensen)
- ba46a6f - docs(spec): add deterministic ticket scorer design specification (Chris Sorensen)

## Version 2.80.3
Date: 2026-10-03

### Changes
- f27da3b - Merge pull request #74 from sorensencc-dotcom/topic/willys-overland-breakout (Chris Sorensen)
- 1b223fe - Register Willys-Overland as its own CIC topic. (Chris Sorensen)

## Version 2.80.2
Date: 2026-10-02

### Changes
- 88b7a3d - Merge pull request #73 from sorensencc-dotcom/parkd821-20260908 (Chris Sorensen)
- d1aea97 - fix(cic): pin delivery guard dependency (Chris Sorensen)

## Version 2.80.1
Date: 2026-10-02

### Changes
- f97ca2c - Merge pull request #72 from sorensencc-dotcom/parkd821-20260908 (Chris Sorensen)
- 0d741a5 - fix(toolforge-pdf): register plugin in CLI exec test (fixes #69) (Chris Sorensen)
- 4ee177f - docs(plan): unified doc sync plan rev 4 (11 tasks, 8 products) (Chris Sorensen)
- 2322d53 - docs(report): add daily report for 2026-10-02 (Chris Sorensen)
- 1c38469 - docs(status): record PR 71 mergeability and resolution (Chris Sorensen)

## Version 2.80.0
Date: 2026-10-02

### Changes
- cdf4bed - Merge pull request #71 from sorensencc-dotcom/parkd821-20260908 (Chris Sorensen)
- 6561d61 - Merge branch 'main' of github.com:sorensencc-dotcom/toolforge into parkd821-20260908 (Chris Sorensen)
- c9fa97c - chore(wiki): update auto-healed property profiles and sync ledger (Chris Sorensen)
- 576d859 - fix(ci): resolve watchdog repo root from caller (Chris Sorensen)
- 6a5095c - docs(plan): add knowledge pack compaction and hardening plan and status record (Chris Sorensen)
- 08f7daa - feat(pack): add lossless whitespace normalization and paragraph-aware partitioning (Chris Sorensen)
- 9a0e049 - test(pack): add comprehensive consolidation hardening test suite (Chris Sorensen)
- 7b0a61e - fix(wiki): rotate Log.md instead of growing it unbounded (Chris Sorensen)
- ddec754 - feat(trm): deterministic decision extraction parser and schema validator (Chris Sorensen)
- 78e1460 - feat(security): agent sandbox egress gatekeeper and scratchpad guard (Chris Sorensen)
- 272c0a5 - docs(governance): add ADR template; close spec review gaps (Chris Sorensen)
- af12d2b - feat(trm): closed-loop mobile ingress and outbox verification (Chris Sorensen)
- 70f6832 - docs(spec): fix ADR index scope and rename-aware --since (Chris Sorensen)
- f440996 - docs(status): record auto-committer investigation findings (Chris Sorensen)
- 3c3e9d3 - docs(spec): move ADR process design to docs/meta/specs (Chris Sorensen)
- 01e78e2 - docs(spec): add ADR process design (Chris Sorensen)

## Version 2.79.0
Date: 2026-10-01

### Changes
- b37b9fd - Merge pull request #70 from sorensencc-dotcom/merge-ci-governance-fix (Chris Sorensen)
- 2290f60 - Merge merge-ci-governance-fix into main (Chris Sorensen)
- be42ea8 - docs(report): add daily report for 2026-10-01 (Chris Sorensen)
- 2512fed - fix(ci): harden governance matrix checkout (Chris Sorensen)
- 027bf3d - feat(trm): wire dynamic query expansion and harden multi-notebook dispatch (Chris Sorensen)
- ce880c3 - docs(governance): re-review a product index when its repo moves past last_reviewed (#68) (Chris Sorensen)
- db40d04 - docs(status): record Meridian isolation pass and idle-time decision (Chris Sorensen)
- 646a736 - fix(telemetry): store post-heal probe in ironledger-sentinel (Chris Sorensen)
- e27c7f8 - docs(status): record Meridian history and missing-report findings (Chris Sorensen)
- b1ea095 - feat(telemetry): add Meridian day/week collectors and git activity tracker (Chris Sorensen)
- d5c9ced - feat(icf): add Meridian focus telemetry to ICF hook (Chris Sorensen)
- 470737f - test: untrack ICF telemetry artifacts; add Meridian isolation check (Chris Sorensen)
- 9bb3f0d - docs(report): add daily report for 2026-09-30 (Chris Sorensen)
- b5657ed - docs(governance): require a MkDocs index for known products (#67) (Chris Sorensen)
- ad6a915 - docs(governance): update STATUS.md and memory for 10-Ironbot fleet (Chris Sorensen)
- 45bed56 - fix(dashboard): update operations badge and fleet definitions to 10 Ironbots (17 Tasks) (Chris Sorensen)
- 3400040 - feat(ironbots): add IronLedger-Sentinel supervisor bot and scheduled task wrapper (Chris Sorensen)
- 0860b00 - docs(trm): document TRM diff-only ingestion protocol v2.9.0 and live verification in STATUS.md (Chris Sorensen)
- 2f022d5 - docs(audit): close repo-sprawl audit, archive retired clone residue (Chris Sorensen)
- 02b928a - docs(audit): close sigil and toolforge repo-sprawl clusters (Chris Sorensen)
- 7ca7082 - docs(report): add daily report for 2026-09-29 (Chris Sorensen)
- 0073622 - fix(ops): heal kb-sentinel schemas and bind dynamic dashboard action items (Chris Sorensen)
- 2edb35c - feat(fleet): integrate Jev typed primitives, TRM mobile triage, generator determinism, and TorqueQuery observability (closes #66) (Chris Sorensen)

## Version 2.78.0
Date: 2026-09-29

### Changes
- c29c3b6 - feat(fleet): integrate Jev typed primitives, TRM mobile triage, generator determinism, and TorqueQuery observability (closes #66) (#66) (Chris Sorensen)

## Version 2.77.1
Date: 2026-09-28

### Changes
- 18dac37 - fix(governance): preserve wiki frontmatter, harden push gate, and align brand & readme docs (#64) (Chris Sorensen)

## Version 2.77.0
Date: 2026-09-28

### Changes
- 81372cf - feat(skills): add usagecheck skill for Claude Code, Codex, and Grok (#65) (Chris Sorensen)

## Version 2.76.0
Date: 2026-09-28

### Changes
- 8a88301 - fix(ironbots): add schema validation, pack size budget guards, and dynamic gap path resolution (Chris Sorensen)
- 3d7ff3d - docs: address final-review findings — governance validator, CIC disambiguation wording, citation accuracy (Chris Sorensen)
- a700bbc - docs(cic-governance): file Tier 1 proposal bundling 4 audit-driven decisions (Chris Sorensen)
- 77d4749 - feat(cic-governance): add candidate gate-status generator (not wired live) (Chris Sorensen)
- 3ae014f - docs: add reverse-index (Referenced by) section to docs/meta/governance/README.md (Chris Sorensen)
- 33ba14a - [claude] docs: add CIC disambiguation banner to CIC-GOVERNANCE Spec v2.4.0 (Chris Sorensen)
- b601686 - docs: record castironforge archive recoverability findings (no deletion) (Chris Sorensen)
- bdbcbc1 - docs: add design doc for CIC docs/governance remediation (Chris Sorensen)
- 0334121 - docs: add CIC docs/governance remediation implementation plan (Chris Sorensen)
- bd9fab8 - chore(slop-sweep): update drift/SLOP-REPORT.md (github-actions[bot])
- a98175e - docs(governance): add helix brand bucket, icf hybrid example, Gollum HTML-comment frontmatter allowance, registry rows for 6 more product wikis (#59) (Chris Sorensen)
- 6d131d6 - docs(governance): require parchment fills for CIC wiki diagrams (v1.2) (#57) (Chris Sorensen)
- f31f49c - docs(wiki): strip kb-sync contamination from toolforge sidebar (#58) (Chris Sorensen)

## Version 2.75.0
Date: 2026-09-27

### Changes
- 58da2f7 - feat(skills): add chris-mode working-conventions skill (#54) (Chris Sorensen)
- 6f39772 - Merge pull request #56 from sorensencc-dotcom/docs/brand-matrix-sigil-rewrite-2026-09-26 (Chris Sorensen)
- 0767d0b - docs(governance): add sigil and rewrite-docs brand-matrix buckets (Chris Sorensen)
- 96a1cda - Merge pull request #55 from sorensencc-dotcom/docs/wiki-sync-registry-2026-09-26 (Chris Sorensen)
- 96f706c - docs(governance): add wiki sync registry for per-product canonical side (Chris Sorensen)
- 0260d39 - Merge pull request #53 from sorensencc-dotcom/docs/readme-about-pass-2026-09-26 (Chris Sorensen)
- 68f5187 - docs(wiki): Home frontmatter, footer identity, strip file:// links (Chris Sorensen)
- d513af1 - docs(readme): R-rules Status/Audience/Quick start/Docs/Governance pass (Chris Sorensen)
- 91a0389 - Merge pull request #52 from sorensencc-dotcom/docs/wiki-style-structure-2026-09-26 (Chris Sorensen)
- 934a01a - docs(governance): add wiki style & structure guideline (Chris Sorensen)

## Version 2.74.0
Date: 2026-09-26

### Changes
- 4b1436e - Merge pull request #51 from sorensencc-dotcom/feat/devin-push-gate-47 (Chris Sorensen)
- da14517 - feat(git): add git-push-and-wait terminal blocking gate for Devin AI reviews (closes #47) (Chris Sorensen)

## Version 2.73.1
Date: 2026-09-26

### Changes
- f3b1748 - Merge pull request #49 from sorensencc-dotcom/parkd821-20260908 (Chris Sorensen)
- 22cba94 - fix(ironbots): remediate 10 Devin AI review findings on PR #45 (#48) (Chris Sorensen)
- f828c84 - fix(trm): harden ingress watcher with cross-volume move fallback and concurrent processing guards (Chris Sorensen)

## Version 2.73.0
Date: 2026-09-26

### Changes
- 528e44e - Merge pull request #45 from sorensencc-dotcom/parkd821-20260908 (Chris Sorensen)
- 1e0bcf3 - docs(trm): update TRM mobile ingress architecture diagram and image assets to strict Cathryn Lavery standards (Chris Sorensen)
- 5ee0e10 - feat(ironbots): harden fleet with thrash guard, host heartbeat, and TRM-Drive-Sync alignment (Chris Sorensen)
- ef299b6 - docs(trm): update TRM mobile ingress architecture diagram to Forge design system standards (Chris Sorensen)

## Version 2.72.0
Date: 2026-09-26

### Changes
- d16429b - Merge pull request #44 from sorensencc-dotcom/parkd821-20260908 (Chris Sorensen)
- 4835bab - feat(trm): implement mobile ingress & auto-triage pipeline with ICF integration and remote wiki sync (Chris Sorensen)
- afe0158 - Merge pull request #42 from sorensencc-dotcom/tmp-fixci-20260926 (Chris Sorensen)
- 3e66219 - Merge remote-tracking branch 'origin/main' into tmp-fixci-20260926 (Chris Sorensen)
- 99000ae - docs(wiki): synchronize synthesized Layer 2 research topics with WHY-EVIDENCE provenance (Chris Sorensen)
- 9656519 - feat(trm): add why-verifier module and integrate into Step 4 Layer 2 wiki synthesis (Chris Sorensen)

## Version 2.71.0
Date: 2026-09-26

### Changes
- 76adc79 - Merge pull request #41 from sorensencc-dotcom/parkd821-20260908 (Chris Sorensen)
- abcce12 - feat(trm): add why-verifier module, unit tests, and closed-loop synthesis integration (Chris Sorensen)
- 0879150 - docs: address caveman review findings in TRM synthesis why spec and plan (Chris Sorensen)
- e6cb613 - docs: add TRM synthesis why integration implementation plan (Chris Sorensen)
- 4805ad0 - docs: address codex-review findings in TRM synthesis why design spec (Chris Sorensen)
- bcb780e - docs: add TRM closed-loop synthesis /why integration design spec (Chris Sorensen)
- 0c1cac8 - docs: add /why skill implementation plan (Chris Sorensen)
- 3370d8e - docs: caveman-review fixes — path annotation, YAML syntax, signal placement, stale path (Chris Sorensen)
- ae5c24d - docs: ponytail-review cuts — drop type field, confidence floats, SINGLE-SOURCED verdict (Chris Sorensen)
- 66babab - docs: address second-opinion review findings in /why spec (Chris Sorensen)
- d4e46cd - docs: add /why skill design spec (Chris Sorensen)
- 055cff1 - feat(ironledger): add verify-ironledger skill and runtime harness (Chris Sorensen)
- 50fd95c - docs(report): add daily report for 2026-09-25 (Chris Sorensen)

## Version 2.70.0
Date: 2026-09-25

### Changes
- bee3190 - Merge pull request #40 from sorensencc-dotcom/parkd821-20260908 (Chris Sorensen)
- d7e68a9 - feat(benchmark): add CLI gate evaluation and benchmark runner entrypoint (Chris Sorensen)
- bd226a9 - feat(benchmark): add atomic artifact persistence and fixture hashing (Chris Sorensen)
- fa95c0d - fix(benchmark): support --expose-gc property assignment in runner tests and include stageName in timeout errors (Chris Sorensen)
- 609ec9e - feat(benchmark): add isolated monotonic benchmark runner harness (Chris Sorensen)
- 028029a - feat(benchmark): add statistical distribution and dynamic gate calculations (Chris Sorensen)

## Version 2.69.0
Date: 2026-09-25

### Changes
- 11fe083 - Merge pull request #39 from sorensencc-dotcom/parkd821-20260908 (Chris Sorensen)
- 7149bc6 - docs(slop-grader-sweep): add reference link to skill operator guide (Chris Sorensen)
- e0d9e39 - docs(notebook-sync): add operator guide and implementation plan (Chris Sorensen)
- 0a9bd98 - feat(notebook-sync): add cell-targeted prompt sync engine and validator (Chris Sorensen)

## Version 2.68.0
Date: 2026-09-23

### Changes
- 01ecee0 - Merge branch 'parkd821-20260908' (Chris Sorensen)
- 0e7ec24 - fix(slop-grader-sweep): make the hook block reachable and the sweep workflow advisory (Chris Sorensen)
- 8aa844c - fix(slop-grader-sweep): correct the slop-grader CLI and JSON contract (Chris Sorensen)
- 3470438 - fix(slop-grader-sweep): sentence-case SKILL.md heading for heuristics lint Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com> (Chris Sorensen)
- 9c26be4 - feat(slop-grader-sweep): add scheduled workflow, SKILL.md, README, and usage docs (Chris Sorensen)
- 93a3c43 - feat(slop-grader-sweep): add scheduled workflow, SKILL.md, README, and usage docs (Chris Sorensen)
- b209c11 - docs(drive-it): add mobile-to-drive dual-channel operational specification (Chris Sorensen)
- 58a0144 - feat(slop-grader-sweep): add idempotent pre-commit hook installer (Chris Sorensen)
- b1bda56 - feat(slop-grader-sweep): add sweep-mode orchestrator with retry and DEGRADED reporting (Chris Sorensen)
- 77a421a - fix(slop-grader-sweep): catch sync collaborator errors in changed-mode orchestrator (Chris Sorensen)
- c8bbbfe - feat(slop-grader-sweep): add changed-mode orchestrator and CLI entrypoint (Chris Sorensen)
- e984acb - feat(slop-grader-sweep): add SLOP-REPORT.md formatter (Chris Sorensen)
- 5cfb2f8 - docs(report): add daily report for 2026-09-22 (Chris Sorensen)
- 461c5e6 - feat(slop-grader-sweep): add subprocess runner with 30s timeout (Chris Sorensen)
- cdeaaf6 - feat(slop-grader-sweep): add changed and sweep file-list resolvers (Chris Sorensen)
- 903ade9 - feat(slop-grader-sweep): add non-throwing OpenRouter credential adapter (Chris Sorensen)
- 5b90211 - feat(slop-grader-sweep): scaffold skill package (Chris Sorensen)
- d8dff66 - docs(meta): address caveman-review findings on slop-grader spec (Chris Sorensen)
- 844dd01 - docs(meta): add slop-grader integration design spec (Chris Sorensen)
- 6c6f928 - fix(ci-watchdog): filter superseded failures and add test coverage (Chris Sorensen)
- 2a64780 - test(notebooklm): add paired regression tests for consolidate-pack and dispatch-multi-notebook (Chris Sorensen)
- e354e2a - feat(notebooklm): persist dispatch status telemetry to notebook_ingester_report.json (Chris Sorensen)
- e787c20 - fix(consolidate-pack): exclude staging directories from source scanning (Chris Sorensen)
- 563bf57 - docs(trm): add KIS-P implementation plan documentation (Chris Sorensen)
- 964a0d6 - feat(ironbots): remediate code review findings across Standards and Spec requirements (Chris Sorensen)
- 46040a0 - chore(trm): register KIS-P validation and sync npm scripts with E2E test (Chris Sorensen)
- 583cf4c - feat(trm): implement asynchronous concurrent multi-notebook dispatcher (Chris Sorensen)
- f340a80 - refactor(nlm): refactor uploader to consume canonical config with fail-closed error handling (Chris Sorensen)
- 40df27f - feat(kb-sync): enforce 380 KiB serialized byte ceiling, deterministic chunking, and stale-pack purging (Chris Sorensen)
- 51562de - feat(kb-sync): add cross-notebook digest injector with word-boundary matching and dynamic target lookup (Chris Sorensen)
- fe502c3 - fix(kb-sync): enforce master-kb domain isolation, deduplicate provenance serialization, and respect category filters (Chris Sorensen)
- dc5a183 - feat(trm): implement Entity Topic Registry semantic validator with structured rule taxonomy (Chris Sorensen)
- 90341c8 - feat(trm): establish Entity Topic Registry schema and canonical manifest (Chris Sorensen)
- cd25a3f - docs(report): add daily report for 2026-09-21 (Chris Sorensen)
- 82528a9 - test(governance): add paired regression tests for scheduled task reconciler and weekly reporting scripts (Chris Sorensen)
- 7b93749 - feat(scheduler): add scheduled tasks reconciler and categorize fleet tasks under canonical folders (Chris Sorensen)
- 40f4c56 - fix(daemon-healer): delegate process lifecycle recovery to ensure-dashboard-server.ps1 (Chris Sorensen)
- 81a7bd5 - feat(ironbots): expand fleet with Notebook-Ingester, Watchlist-Miner, and SQLite FTS5 search (Chris Sorensen)
- 191dbd9 - docs: add dev-idea-pipeline.md for unbuilt dev ideas (Chris Sorensen)
- 8c0a69c - docs: update STATUS.md with Ironbots fleet status and documentation-first rule (Chris Sorensen)
- 8dfe301 - fix(daemon-healer): point target URL to ICF dashboard /dashboard and supervise ICF gateway (Chris Sorensen)
- 8723809 - feat(dashboard): register Ironbots autonomous fleet panel and test runner (Chris Sorensen)
- 8a9f822 - feat(bots): expand Ironbots fleet with Daemon-Healer and CI-Watchdog, tests, and unattended autonomy policy (Chris Sorensen)
- 699c628 - feat(bots): implement Ironbots autonomous KB sentinel and TRM triage bot pipelines with regression tests and docs (Chris Sorensen)
- d7359fc - feat(trm): implement cross-notebook gap deduplication and lifecycle engine (Chris Sorensen)
- c9d48af - feat(skills): add docker container image scanning to third-party-repo-auditor (Chris Sorensen)
- ea1e4b8 - feat: isolate serial merge validation (Chris Sorensen)
- 9fac3bf - feat: enforce repair tripwires (Chris Sorensen)
- eec81c1 - docs(memory): consolidate memory index, deprecate claude-memory, and update verification timestamps (Chris Sorensen)
- 42bb14e - feat(skills): add third-party-repo-auditor skill with validation passing (Chris Sorensen)
- bd007e5 - chore(sync): update status feed and wiki research property logs (Chris Sorensen)
- ac6ccde - refactor(toolforge): simplify CLI HTTP clients and ESM paths per Ponytail audit (Chris Sorensen)
- b9a054a - feat: request explicit retro actions (Chris Sorensen)
- 2460f4a - feat: publish retro through ICF bridge (Chris Sorensen)
- 1893cbf - docs(report): add daily report for 2026-09-19 (Chris Sorensen)
- f3ef7ca - chore(sync): update status feed, logs, and property extract timestamp (Chris Sorensen)
- 067961d - docs(report): add daily report for 2026-09-19 (Chris Sorensen)
- 728fcbc - docs(report): add daily report for 2026-09-18 (Chris Sorensen)
- b7773ee - docs(report): add daily report for 2026-09-17 (Chris Sorensen)
- 72e8717 - docs(report): add daily report for 2026-09-15 (Chris Sorensen)
- 53c7905 - docs(report): add daily report for 2026-09-14 (Chris Sorensen)
- 9f79ea0 - fix(nlm): default nlmCli to 'nlm' executable and record live pack generations (Chris Sorensen)
- 0c142d8 - feat(nlm): atomic upload-verify-purge replace gate for split knowledge packs (Chris Sorensen)
- 1604933 - chore(sync): update multi-agent memory journal (Chris Sorensen)
- 66e7220 - feat(architecture): partition knowledge plane, sync ecosystem architecture guide, and update notebook targets (Chris Sorensen)
- a4716dc - docs(report): add weekly report for 2026-W37 (Chris Sorensen)
- 591cda0 - docs(status): update WhichLLM status with empirical live benchmarking and Helix defense verification (Chris Sorensen)
- 71ac7f1 - docs: align STATUS evidence language with deterministic BFCL evaluator & atomic write updates (Chris Sorensen)
- 193252c - feat(scripts): add weekly retro automation wrapper (Chris Sorensen)
- ab263d4 - docs: update STATUS with verified WhichLLM evaluator implementation and Helix defense (Chris Sorensen)
- c62c0d3 - fix(delivery-guard): resolve Windows shell binary lookup in hook test and update STATUS (Chris Sorensen)
- cddc316 - docs(memory): verify retro slowdown as genuine, fix orphaned CLAUDE.md line citation (Chris Sorensen)
- 1033b98 - docs(governance): fix stale memory window, orphaned commit-hash citation, retro window drift (Chris Sorensen)
- a5da7ea - docs(status): register notebooklm-mcp in Unified MCP Matrix (Chris Sorensen)
- 5ff4600 - docs(status): register IronLedger and Headroom in Unified MCP Matrix (Chris Sorensen)
- 5157349 - docs(design-system): archive Cast Iron Charlie audit request and light-theme extension (Chris Sorensen)
- d14559b - feat(torquequery): add unified orchestrator, disk adapters, and pipeline test suite (Chris Sorensen)
- f5254d4 - fix(notebooklm): add pre-upload deduplication sweep and prune duplicate sources (Chris Sorensen)
- d48d4b3 - feat(sync-tools): wire STATUS.md into memory and todo sync engines (Chris Sorensen)
- 904a432 - feat(sync-tools): wire .ijfw/memory handoff and project journal into multi-agent sync (Chris Sorensen)
- 9ef8a76 - docs(report): add daily report for 2026-09-12 (Chris Sorensen)
- a347ce8 - feat(design): remediate CIC audit findings, add light theme extension and financial design guidelines (Chris Sorensen)
- f495663 - chore(sync): update multi-agent active task matrix (Chris Sorensen)
- a2d6360 - feat(sync-tools): add multi-agent todo and task list synchronization engine (Chris Sorensen)
- 0837b00 - chore(sync): update repository agent memory pointers (Chris Sorensen)
- 2fe015a - feat(automation): add scheduler setup script for background agent memory sync (Chris Sorensen)
- 9cc0eab - fix(sync-tools): ensure managed region replaces cleanly without duplicate appends (Chris Sorensen)
- bea425c - feat(sync-tools): add multi-agent memory synchronization to obsidian vault (Chris Sorensen)
- 37ee666 - docs(plan): add multi-agent memory sync implementation plan (Chris Sorensen)
- 3129462 - docs(spec): add strict receipt invariants, upward repo discovery, and collision-safe rollback (Chris Sorensen)
- 7794d6b - docs(spec): add atomic rollback, tilde guards, fail-closed validation, and receipt invariants (Chris Sorensen)
- 255b3d7 - docs(spec): finalize multi-agent memory sync spec addressing all codex review gaps (Chris Sorensen)
- 99af5ab - docs(spec): harden multi-agent memory sync spec with format-safe mutations, atomic writes, and discovery exclusions (Chris Sorensen)
- b323264 - docs(spec): add onboarding runbook, diagram standards, and codex review step to memory sync spec (Chris Sorensen)
- 58934af - docs(spec): add multi-agent memory sync to obsidian vault design spec (Chris Sorensen)
- 63135d1 - feat(mcp): register shared ironledger mcp server (Chris Sorensen)
- df71beb - docs(report): add daily report for 2026-09-11 (Chris Sorensen)
- 13e3be7 - docs(governance): consolidate global operating rules to canonical version (Chris Sorensen)
- 69204e1 - feat(dashboard): integrate headroom context optimization into icf dashboard and telemetry (Chris Sorensen)
- 8126cc0 - fix: preserve drift detector fallback target (Chris Sorensen)
- b35ce9b - fix: make drift detector paths portable (Chris Sorensen)
- 4ec705e - chore(sync): reformat code + resync daily_status/project-journal (Chris Sorensen)
- 81aea1c - docs(report): add daily report for 2026-09-10 (Chris Sorensen)
- e96dc1e - feat(ui): update Cast Iron Charlie design system palette and sync tokens (Chris Sorensen)
- 5f68dbf - docs(governance): allow scoped C dev repositories (Chris Sorensen)
- 9e572de - feat(mcp): add open-notebook mcp server to canonical registry and sync profiles (Chris Sorensen)
- 09d08ce - feat(dashboard): document Iron Command Forge integration and sync daily status feed (Chris Sorensen)
- 91a8040 - fix(mcp): configure sigil connector grants, credentials, and chrome-devtools global path (Chris Sorensen)
- 5a331f8 - chore(mcp-registry): update sigil connector env and chrome-devtools global bin path (Chris Sorensen)
- e22ba3e - fix(mcp-governance): add PYTHONPATH env injection for ironledger and multi-segment header support to registry parser (Chris Sorensen)
- 09e1855 - feat(mcp-governance): fold ironledger read-only mcp server into canonical registry and client profiles (Chris Sorensen)
- e3528f1 - docs(report): add daily report for 2026-09-09 (Chris Sorensen)
- 9e4f2c6 - chore(sync): update skillpack metadata and cowork audit artifacts (Chris Sorensen)
- 850c244 - docs(mcp): add architecture documentation and Cathryn Lavery diagram asset (Chris Sorensen)
- 3ab8545 - feat(mcp): add e2e integration and janitor cooperation test suite (Chris Sorensen)
- 4249b5c - feat(mcp): implement unified cli controller and profile manifest dashboard (Chris Sorensen)
- d245004 - feat(mcp): implement surgical ast compilers and atomic backup writers (Chris Sorensen)
- 8187a04 - feat(mcp): implement registry parser, budget validator, and exit codes (Chris Sorensen)
- 02e90fd - feat(mcp): add canonical mcp-registry.toml with registry_version (Chris Sorensen)
- 09bd52e - feat(mcp): add profile manifest dashboard, exit codes, and registry versioning (Chris Sorensen)
- 7e8c4ee - docs(plans): add multi-client mcp governance implementation plan (Chris Sorensen)
- 475bf9f - docs(specs): refine mcp governance spec with ast safety, exact token validation, and profile definitions (Chris Sorensen)
- 9b6f5f8 - docs(specs): add multi-client mcp governance and profile design spec (Chris Sorensen)
- d821fb4 - fix(skills): quote description in research-questions frontmatter (Chris Sorensen)
- d9ee1ab - chore(sync): add uncommitted claude-memory session wraps (Chris Sorensen)
- 6c4ee06 - chore(gitignore): ignore daemon artifacts and nested working repos (Chris Sorensen)
- c08b426 - chore(sigil): configure persistent postgresql store in mesh supervisor (Chris Sorensen)
- 7fa4323 - docs(governance): ratify hybrid provider policy (Chris Sorensen)
- ab18003 - feat(nlm-trm): automate source deduplication across pipelines and notebooks (Chris Sorensen)
- 2f32bab - docs(report): add daily report for 2026-09-07 (Chris Sorensen)
- 5a82a0f - fix(delivery-guard): handle unreachable or replaced base SHAs defensively in commitChangeSets (Chris Sorensen)
- 3c0ad6b - feat(governance): add intercept-grep hook with regression test suite and deterministic search policy (Chris Sorensen)
- 6cf00af - feat(mcp): mirror vfs_upsert_document to toolforge Viking VFS surface (Chris Sorensen)
- ab612ca - feat(sigil): add sigil mesh daemon scripts and grok bridge stdio adapter (Chris Sorensen)
- 3117d49 - docs(report): add weekly report for 2026-W36 (Chris Sorensen)
- 1db1aa0 - chore(registry): register sigil-grok-bridge in central skill manifest (Chris Sorensen)
- 15be2bf - docs(ironledger): fold Phase 3 eng-review decisions A4.1 + T3.1 into compiler spec (Chris Sorensen)
- 34e3b0d - feat(skills): add sigil-grok-bridge keyless MCP adapter and conformance suite (Chris Sorensen)
- 7521573 - docs(governance): correct false enforcement claim, refresh stale project memory (Chris Sorensen)
- 10121db - docs(ironledger): Phase 3 Beancount compiler and recovery journal design (Chris Sorensen)
- 86d1a9b - test(vfs): add vfs reporting telemetry contract test suite (Chris Sorensen)
- 51b6a2f - docs(report): add daily report for 2026-09-05 (Chris Sorensen)
- 67c61ef - feat(viking): add dynamic reporting and integrity check (Chris Sorensen)
- 38fc9f7 - docs(plan): refine implementation plan with schema versioning, strict boundaries, and test runbook (Chris Sorensen)
- 0bb3207 - docs(plan): add Toolforge Herdr TRM integration implementation plan (Chris Sorensen)
- 93993e6 - docs(report): add daily report for 2026-09-04 (Chris Sorensen)
- 35207ca - docs(spec): add Toolforge Herdr TRM integration design (Chris Sorensen)
- a13a062 - docs(trm): codify RFC GAPs 17-21 on assembly line origins and executive power struggles (Chris Sorensen)
- 4d40f47 - chore(metadata): update skillpack metadata and validation reports (Chris Sorensen)
- 183a0c6 - feat(trm): synthesize canonical RFCs for gaps 12 through 16 (Chris Sorensen)
- 4582042 - docs(trm): codify sovereign architecture and expanded historical treatments dossier (Chris Sorensen)
- e2d8e7c - feat(trm): synthesize canonical RFCs and deploy script claim linter (Chris Sorensen)
- d3779f1 - docs(diagrams): add diagram build scripts and enforce Cathryn Lavery wiki standards (Chris Sorensen)
- 3401e00 - docs(ironledger): Phase 2b execution handoff — plan approved, resume point (Chris Sorensen)
- 82f602b - docs(ironledger): fold plan-eng-review findings into Phase 2b spec and plan (Chris Sorensen)
- f69aaed - docs(governance): add third-party tool provenance policy and update wiki attribution (Chris Sorensen)
- ba1e1b2 - feat(trm): add rfc-gap-07 danish pipeline transatlantic telemetry (Chris Sorensen)
- e6e3c85 - docs(report): add daily report for 2026-09-03 (Chris Sorensen)
- da9007b - docs(ironledger): Phase 2b implementation plan (15 TDD tasks) (Chris Sorensen)
- 009a76e - docs(ironledger): amend Phase 2b spec for migration-runner and audit-envelope constraints (Chris Sorensen)
- 6af4dfb - docs(ironledger): Phase 2b review and categorization design (Chris Sorensen)

## Version 2.67.1
Date: 2026-09-20

### Changes
- f9296cd - docs(retro): clarify neutral placeholders for test inventory in 2026-09-14 retro (Chris Sorensen)

## Version 2.67.0
Date: 2026-09-20

### Changes
- 905912a - merge: integrate v2.66.4 release (Chris Sorensen)
- fcda28e - feat(retro): explain test ratio evidence (Chris Sorensen)

## Version 2.66.4
Date: 2026-09-20

### Changes
- 03936a8 - docs: reconcile weekly session audit (Chris Sorensen)

## Version 2.66.3
Date: 2026-09-14

### Changes
- 53f1a32 - Merge pull request #38 from sorensencc-dotcom/fix/nlm-closed-loop-pack-replace-gate (Chris Sorensen)
- 9f6cfd3 - fix(nlm): match politics/knowledge pack titles in replace gate (Chris Sorensen)
- 1f1d014 - fix(nlm): pre-upload pack replace gate for closed-loop push (Chris Sorensen)

## Version 2.66.2
Date: 2026-09-09

### Changes
- a653af3 - Merge pull request #37 from sorensencc-dotcom/chore/gitignore-daemon-artifacts (Chris Sorensen)
- 4434da9 - chore(gitignore): ignore daemon artifacts and nested working repos (Chris Sorensen)

## Version 2.66.1
Date: 2026-09-09

### Changes
- 97ca342 - Merge pull request #35 from sorensencc-dotcom/chore/serial-merge-queue-hardening (Chris Sorensen)
- c835354 - Merge pull request #36 from sorensencc-dotcom/ironledger/phase-3-docs (Chris Sorensen)
- a3076c3 - docs(ironledger): add Phase 3 Beancount compiler and recovery journal design (Chris Sorensen)
- 456859a - fix(merge-queue): validate on staging ref, not main (Chris Sorensen)

## Version 2.66.0
Date: 2026-09-08

### Changes
- 1471f6d - feat: wire validated Ollama routing (Chris Sorensen)
- bc2f4c8 - Merge origin/main into feat/trm-devops-path-safety-reconcile (Chris Sorensen)
- 7f4ce3d - feat: wire validated Ollama routing (Chris Sorensen)
- 6777187 - fix(runtime-owner): support health-only consumer checks (Chris Sorensen)
- f65f9e8 - feat(runtime-owner): add Phase B consumer harness (Chris Sorensen)
- 97a7f60 - chore: update runtime owner handoff (Chris Sorensen)
- 2535734 - docs: close runtime owner phase A (Chris Sorensen)
- 082ec31 - docs: record runtime owner verification (Chris Sorensen)
- d9125a0 - test: register runtime owner focused suite (Chris Sorensen)
- 552fd48 - fix: harden runtime owner process accounting (Chris Sorensen)
- 03b2ee2 - fix: harden runtime owner lifecycle (Chris Sorensen)
- 98b451c - feat: add Linux runtime owner Phase A (Chris Sorensen)
- 1ccc932 - docs: close runtime owner design review (Chris Sorensen)
- a7cbdf5 - docs: design Toolforge runtime owner phase A (Chris Sorensen)
- a6d8c35 - docs: prepare Open Notebook process handoff (Chris Sorensen)
- b485778 - feat: add isolated Open Notebook adapter (Chris Sorensen)
- 4b9d78b - feat: add research substrate contracts (Chris Sorensen)
- 352c29d - test: characterize TRM research script seam (Chris Sorensen)
- 1323d7f - docs: lock Open Notebook HTTP contract (Chris Sorensen)
- c0a7777 - docs: plan Open Notebook contract lock (Chris Sorensen)
- 57d2f26 - docs: block Open Notebook contract until locked (Chris Sorensen)
- 50c8935 - docs: record Open Notebook boundary prerequisite (Chris Sorensen)
- 61159db - docs: record Open Notebook review decisions (Chris Sorensen)
- 0fc115c - docs: define Open Notebook research substrate (Chris Sorensen)
- 93cb2e5 - feat(trm-devops): reconcile path safety checks into MCP server and export path-safety core (Chris Sorensen)

## Version 2.65.0
Date: 2026-09-07

### Changes
- 779bcb9 - feat(utilities): add conservative node process janitor (#32) (Chris Sorensen)

## Version 2.64.0
Date: 2026-09-07

### Changes
- 1134846 - feat(mcp): mirror vfs_upsert_document to toolforge Viking VFS surface (#31) (Chris Sorensen)

## Version 2.63.1
Date: 2026-09-05

### Changes
- 2609f81 - Feat/toolforge herdr trm integration (#30) (Chris Sorensen)
- 7016fd6 - docs(ironledger): Phase 2b handoff and resume point (Chris Sorensen)
- 373b44e - docs(ironledger): add Phase 2a spec and plan referenced by the exit evidence (Chris Sorensen)
- 7d221b0 - docs(ironledger): record Phase 2a exit-gate approval (Chris Sorensen)
- f4e9ae2 - docs(ironledger): Phase 2a dependency posture and exit-gate evidence (Chris Sorensen)
- d659625 - docs(plan): cross-federation directory implementation plan (#4) (Chris Sorensen)
- b895b31 - docs(spec): apply caveman-review to cross-federation directory spec (#4) (Chris Sorensen)

## Version 2.63.0
Date: 2026-09-03

### Changes
- fe29dd9 - docs(wiki): add root wiki page mappings and sidebar links for parallel-search and tinyfish-search (Chris Sorensen)
- 158b109 - feat(trm): resolve open research gaps GAP-02, GAP-03, GAP-06 with archival citations (Chris Sorensen)
- 46ad5fe - docs(wiki): add dedicated wiki documentation for parallel-search and tinyfish-search (#29) (Chris Sorensen)
- 3c471be - docs(spec): apply Codex review to cross-federation directory spec (#4) (Chris Sorensen)

## Version 2.62.1
Date: 2026-09-03

### Changes
- 50580ae - fix(toolforge): normalize entrypoint, add integration diagram, and resolve repository paths dynamically (Chris Sorensen)

## Version 2.62.0
Date: 2026-09-03

### Changes
- 86eabb4 - feat(tinyfish): add tinyfish-search skill — search and Markdown extract via @tiny-fish/sdk (#27) (Chris Sorensen)

## Version 2.61.1
Date: 2026-09-03

### Changes
- 983f7d8 - docs(plan): add TinyFish search skill implementation plan (Chris Sorensen)
- 76ffd4d - docs(spec): address review findings for client guard, types, and timeout semantics (Chris Sorensen)
- 9799ce6 - docs(spec): add provider hygiene, timeout semantics, and future-proofing to TinyFish spec (Chris Sorensen)
- 1f489f6 - chore(sync): register parallel-search skill, refresh skillpack metadata (Chris Sorensen)
- 935bdc5 - fix(skillpack): stop regen from clobbering timestamps and line endings (Chris Sorensen)
- 7a80dd0 - docs(spec): sigil cross-federation directory design (federation #4) (Chris Sorensen)
- bc5f02a - fix(validator): expand canonical skill category allow-list (Chris Sorensen)
- fc17eb2 - docs(meta): add Claude API caching + batch cost checklist, retire DCO-BIP padding engine (Chris Sorensen)
- 7037895 - docs(sigil): fold I1 fabb4fe + I4 MAX_ATTEMPTS=4 into routing plan/spec (Chris Sorensen)
- ef25b6a - chore(sync): bump handoff date to 2026-09-01, append session-end journal entries (Chris Sorensen)
- 099dc06 - docs(report): add weekly report for 2026-W36 (Chris Sorensen)

## Version 2.61.0
Date: 2026-09-02

### Changes
- 3e34488 - feat(trm): add unattended scheduled miner script and resolve GAP-06 dossier (Chris Sorensen)

## Version 2.60.0
Date: 2026-09-02

### Changes
- 8cbb9a2 - feat(graft): add mcp registration, pre-push hook, and ci audit workflow (Chris Sorensen)
- 0283413 - chore: ignore local regen artifacts, point workspace root at C:/dev (Chris Sorensen)
- 340084d - docs(report): add daily report for 2026-09-02 (Chris Sorensen)

## Version 2.59.1
Date: 2026-09-02

### Changes
- 10e17e4 - chore(gitignore): match .ijfw/scan-state.json.tmp.* temp files (Chris Sorensen)

## Version 2.59.0
Date: 2026-09-02

### Changes
- 1edb64c - merge: fold 31 authored commits (ironledger docs, trm GAP, sigil specs, kb-sync, toolforge) into restored main (Chris Sorensen)
- 13cba68 - revert(main): restore repo tree clobbered by runaway wiki-sync 0347469b (Chris Sorensen)
- a73d3d7 - chore: replace retired Claude model pins in work-summarizer and TRM research loop (Chris Sorensen)
- 68adb18 - docs(sigil): mark I1 resolved in the inter-relay routing spec (Chris Sorensen)
- 96c1118 - chore(parallel-search): clear deferred cleanup minors (#25) (Chris Sorensen)
- c4bce21 - chore(parallel-search): post-SDD cleanup — USAGE doc, gitignore + lockfile, test-count floor, task_result debug sink (#24) (Chris Sorensen)
- 80c9b5b - feat(parallel-search): Charlie adapter Task Run routing (#23) (Chris Sorensen)
- fae8f67 - feat(parallel-search): add parallel_task_result wrapper with run_id-preserving timeout handling (#22) (Chris Sorensen)
- d9d8866 - fix(parallel-search): address PR #19 review — guard onError, cover shape-failure path (#21) (Chris Sorensen)
- 72a4757 - refactor(parallel-search): extract defineOperation skeleton, no behavior change (#20) (Chris Sorensen)
- 8d256e7 - test(parallel-search): live smoke test + debug sink (defect 7) (#19) (Chris Sorensen)
- fdd92fd - docs(ironledger): record Phase 1 exit-gate approval (Chris Sorensen)
- a71e3d4 - chore: preflight accepts pyproject.toml, go.mod, or Cargo.toml (Chris Sorensen)
- f0ea493 - docs(sigil): close out inter-relay routing plan + spec (Chris Sorensen)
- 6e4a8e2 - docs(ironledger): submit Phase 1 implementation for operator review (Chris Sorensen)
- 31e419a - fix(parallel-search): SDK call paths, client typing, query cap, beta header, test runner, adapter regression (#18) (Chris Sorensen)
- d4d59b0 - docs(report): add daily report for 2026-09-01 (Chris Sorensen)
- 6d50371 - docs(parallel-search): recovery spec for shipped skill, v1.2 with resolved OQs (Chris Sorensen)
- 3b73964 - docs(ironledger): sentence-case 1.1 heading, note snapshot age (Chris Sorensen)
- cb7139c - docs(ironledger): tidy Phase 0 baseline after repo move (Chris Sorensen)
- b176ecb - docs(ironledger): set C:\dev\IronLedger as the operator-approved repo home (Chris Sorensen)
- 9ff6c01 - Merge pull request #16 from sorensencc-dotcom/codex/parallel-search-charlie-adapter-clean (Chris Sorensen)
- e6a8a08 - docs(ironledger): fold Phase 1 plan review findings into the draft (Chris Sorensen)
- fdd3e29 - docs(ironledger): add Phase 1 plan draft (task breakdown, no implementation) (Chris Sorensen)
- bff19bb - feat: add fail-closed charlie research adapter (Chris Sorensen)
- 842aa65 - docs(ironledger): relocate governed docs to typed subfolders, add Phase 0 baseline (Chris Sorensen)
- 1a6ec60 - docs(report): add daily report for 2026-08-31 (Chris)
- 4125119 - docs: approve IronLedger architecture and implementation plan (Chris)
- 658da2a - feat: sigil inter-relay routing spec & parallel-search skill integration (#15) (Chris Sorensen)
- 20a6031 - feat(trm): resolve GAP-03-CUBA with certified FCSC Decision CU-5843 / Claim CU-3440 (Chris)
- 92a34fd - feat(trm): resolve GAP-04 Dodge vs Ford and GAP-05 Harry Bennett Service Department (Chris)
- a5808fe - feat(trm): resolve GAP-03 B-17 mismatch, GAP-02 Al-Toy banquet, and track GAP-06 B-24 knock-down kits (Chris)
- 60118f9 - feat(trm): register stage 3 research directive for GAP-02 flying cow (Chris)
- a321ce0 - feat(trm): register stage 3 research directives for GAP-03 and FCSC Cuban estate (Chris)
- 2c817fd - fix(toolforge): remediate health warnings, sync manifest skills, and update project memory (Chris)
- aca181f - docs(toolforge): link parallel-search operator guide (Chris)
- b455563 - docs(report): add weekly report for 2026-W35 (Chris)
- f66cb97 - feat(toolforge): register parallel-search skill (5/5 tests passing) (Chris)
- 55f2d1c - docs(plan): sigil inter-relay routing implementation plan (federation #3) (Chris)
- 441a20d - fix(ci): update node-version to 24, fix sigil repo slug, and robust link in governance matrix (Chris)
- 4acee46 - docs(wiki): synchronize Toolforge platform documentation, guides, and sidebar (Chris)
- 74ed129 - ci: enable workflow_dispatch on wave-d and governance matrix workflows (Chris)
- 22b7f29 - docs(wiki): synchronize Toolforge platform documentation, guides, and sidebar (Chris)
- 9f92821 - docs(wiki): synchronize Toolforge platform documentation, guides, and sidebar (Chris)
- 0347469 - docs(wiki): synchronize Toolforge platform documentation, guides, and sidebar (Chris)
- d70dfd8 - fix(ci): use npm install in wave-d and sparse-checkout toolforge in governance matrix (Chris)
- e493304 - docs(wiki): synchronize Toolforge platform documentation, guides, and sidebar (Chris)
- 94e55ef - docs(spec): sigil inter-relay routing design (federation #3) (Chris)
- c40e9ce - test(governance): resolve @-referenced root in test read helper (Chris)
- 28e9781 - feat(kb-sync): add headless NotebookLM uploader and pack consolidation workflow (Chris)
- 61cc1fb - feat(trm): resolve GAP-04 with canonical Willow Run L-bend research note (Chris)
- aaf42b6 - feat(skills): add wiki-sync-recovery diagnostic + fixture-skip test pattern (Chris)

## Version 2.58.1
Date: 2026-08-30

### Changes
- fbf4ec4 - fix(ci): sanitize mock token, fix wave-d action tags, and checkout sibling governance repo in matrix (Chris)

## Version 2.58.0
Date: 2026-08-30

### Changes
- e2b38a6 - Merge branch 'feat/viking-harness-integration' (Chris)
- 4fa14ae - feat: integrate Viking VFS harnesses (Chris)
- 50e0f44 - docs(agents): correct stale roadmap-gate evidence in AGENTS.md (Chris)
- 945ddd5 - Merge branch 'main' into feat/viking-harness-integration (Chris)
- 9e146ed - fix(research): add missing title to frontmatter for validation compliance (Chris)
- 2382e6e - docs(wiki): synchronize Toolforge platform documentation, guides, and sidebar (Chris)
- b0280dc - feat: complete Viking VFS phase 2 (Chris)

## Version 2.57.0
Date: 2026-08-30

### Changes
- a38c9e4 - feat(trm): register 4 new NotebookLM notebooks for closed-loop research (Chris)
- 46b9130 - docs(report): add daily report for 2026-08-30 (Chris)

## Version 2.56.1
Date: 2026-08-30

### Changes
- 83f4981 - chore(merge): conclude merge with origin/main (Chris)
- 15105d4 - chore(merge): sync remote tags and release commits (Chris)
- d9f0d4d - fix(wiki-sync): use unique temporary directory for wiki publisher clones (Chris)
- 9ee34e6 - chore(sync): update TRM research gaps, drift reports, and skill metadata (Chris)

## Version 2.56.0
Date: 2026-08-30

### Changes
- 0614058 - chore(merge): sync remote tags (Chris)
- 17bdc6f - feat(daily-miner): add Tor proxy health telemetry, daily multi-notebook orchestrator, and 9PM scheduler (Chris)

## Version 2.55.1
Date: 2026-08-30

### Changes
- 6ecf4cf - fix(wiki-sync): resolve root image references and add retry logic on Windows (Chris)
- 7afe782 - chore(merge): sync remote updates (Chris)
- ccbe648 - chore(audit): record test suite validation entries in wiki log (Chris)

## Version 2.55.0
Date: 2026-08-30

### Changes
- 8e7f560 - fix(wiki-sync): use SSH repository URL for automated wiki sync (Chris)
- 58457d8 - fix(property-extractor): refine candidate regex filtering and remove unparsed generic profile (Chris)
- cdbec91 - chore(merge): sync origin/main release v2.54.2 (Chris)
- 6a363a9 - feat(research-automation): add live web harvester, topic triage console, property deed extractor, and golden test suite (Chris)
- 3ab6f8c - feat(thematic-partitioning): register Cuban Seizures notebook, add dynamic placeholder lifecycle, and pack validator (Chris)
- a915ec5 - docs(report): add daily report for 2026-08-29 (Chris)

## Version 2.54.2
Date: 2026-08-29

### Changes
- 6972edc - chore(gbrain): configure local pglite engine pin and update status (Chris)

## Version 2.54.1
Date: 2026-08-29

### Changes
- e99aa58 - chore(triage): archive resolved DEV-001 and clear active queue (Chris)

## Version 2.54.0
Date: 2026-08-28

### Changes
- 7f75525 - fix(ci): make CI governance matrix dependency installation resilient across checkouts (Chris)
- 2de6526 - fix(release): align VERSION.md with latest release tag v2.53.0 (Chris)
- 3c29017 - chore(release): v1.1.0 (toolforge-release-bot)
- cfa6a81 - fix(ci): add root VERSION.md, claim DEV-001 in queue, and add paired wiki sync test (Chris)
- 715cc8b - feat(wiki): publish TRM DevOps Triage architecture diagram and specification page (Chris)
- e975ee3 - docs(skills): add Skill Operator Guide references to trm-devops-triage (Chris)
- d41dc2f - feat(skills): add trm-devops-triage skill with full toolforge specification (Chris)
- 3b89305 - chore(sync): update status feed and claude memory nodes (Chris)
- 015c422 - chore(mcp): register trm-devops MCP server in workspace config (Chris)
- 01a8334 - feat(trm-devops): initialize dev/triage queue state and gitignore (Chris)
- c514a92 - docs(status): record TRM DevOps sync and triage pipeline completion (Chris)
- 745aec9 - feat(trm-devops): implement MCP server adapter and tool handlers (Chris)
- f74fd33 - feat(trm-devops): implement CLI commands for sync, prune, and status (Chris)
- 7b2bab1 - feat(trm-devops): implement pruning manager and global index updates (Chris)
- f776eee - feat(trm-devops): implement queue reconciler and atomic markdown generator (Chris)
- 4dce7c8 - feat(trm-devops): implement offline fallback buffer and notebooklm client bridge (Chris)
- f2fa9ee - feat(trm-devops): implement schema validator and dead-letter chunk quarantine (Chris)
- ff2c4c9 - feat(trm-devops): implement concurrency file lock with stale recovery (Chris)
- 030aa5e - feat(trm-devops): implement error trace normalizer and signature hasher (Chris)
- 34dcde4 - feat(trm-devops): scaffold module package and core type interfaces (Chris)
- aabf570 - docs(plan): add TRM DevOps sync and triage pipeline implementation plan (Chris)
- eca1298 - docs(spec): embed simulation-verified normalizer transformation pipeline (Chris)
- b407309 - docs(spec): apply caveman review fixes (stale lock mtime, fallback mkdir, rawText notes, gz atomicity) (Chris)
- 0255311 - docs(spec): enhance TRM DevOps sync pipeline with fallback buffer, file locks, and lineage (Chris)
- 0b6f028 - docs(spec): add TRM DevOps sync and triage pipeline design spec (Chris)
- 5d30733 - feat(scripts): add on-demand TRM NotebookLM miner with daily status refresh (Chris)
- cc279c4 - Merge pull request #14 from sorensencc-dotcom/feat/viking-tier-index (Chris Sorensen)
- 316228c - docs(wiki): synchronize Toolforge platform documentation, guides, and sidebar (Chris)
- f54e02e - feat: pin viking reads to verified snapshots (Chris)
- f1b73ad - feat: derive viking tier freshness (Chris)
- a7f607c - feat: expose standard viking MCP resources (Chris)
- c0f67c6 - feat: integrate viking sqlite tier metadata (Chris)
- 5ac7056 - feat: add sqlite viking tier index (Chris)
- 2713b4a - fix: validate viking snapshot identities (Chris)
- 01ce33f - feat: add viking protocol contract validation (Chris)
- 0e8a65e - fix: enforce viking manifest containment (Chris)
- 667317c - feat: bind viking tiers to snapshots (Chris)
- 4215a7e - fix: emit valid viking JSON-RPC errors (Chris)
- c7ca6e8 - feat: validate viking MCP requests (Chris)
- 15df610 - feat: bound viking directory listings (Chris)
- 4d2f5fd - feat: enforce viking snapshot manifests (Chris)
- 04b44e4 - test: harden viking URI failure handling (Chris)
- 7ca1064 - feat: add read-only viking MCP filesystem (Chris)
- c2b18ad - chore: synchronize workspace agent instructions (Chris)
- 7c0e15e - chore: add fail-closed repository preflight (Chris)
- 32a9807 - docs: specify viking MCP virtual filesystem (Chris)
- 543b2e2 - test: add gate baseline profiler (Chris)
- 955c4a4 - chore: centralize shared agent instructions (Chris)
- ae0ddc1 - ci: onboard wave 3 governance repositories (Chris)
- 09657c0 - ci: add cross-repo governance gate matrix (Chris)
- 17aaca2 - fix(wiki-qa): resolve live wiki inventory slugs, frontmatter collision, and timeout budget (Chris)
- ab1fdaf - feat(governance): bridge TorqueQuery to agent dispatch (Chris)
- 0825b92 - Merge pull request #13 from sorensencc-dotcom/feat/openrouter-oxalpha-integration (Chris Sorensen)
- 887d16a - test(dispatch): verify bounded fallback artifacts and overrides (Chris)
- 9298b23 - test(agent-dispatch): cover contract signing and verification (Chris)
- d6f16d7 - feat(docs): enforce publishing inventory and wiki QA discovery (Chris)
- 044a7ba - fix: scope wiki browser QA link and diagram checks (Chris)
- 60c10a9 - fix(dispatch): enforce single-run trace isolation and truncation (Chris)
- bac8092 - fix(wiki): correct addFrontmatterTitle function call in copyRecursive (Chris)
- cc8d74f - docs(wiki): add WhichLLM hardware-aware evaluator spec and sanitize frontmatter (Chris)
- b5d36c2 - Merge pull request #2 from sorensencc-dotcom/feat/openrouter-oxalpha-integration (Chris Sorensen)
- b300148 - docs(wiki): synchronize Toolforge platform documentation, guides, and sidebar (Chris)
- 2eb1fbd - Merge remote-tracking branch 'origin/main' into feat/openrouter-oxalpha-integration-2 (Chris)
- 9dbb841 - fix(wiki): add trm-gap-triage-architecture diagram asset mappings to wiki publisher (Chris)
- 1136020 - chore(sync): update platform dashboard, journal, and skillpack metadata (Chris)
- 26ddc5a - docs(report): add daily report for 2026-08-27 (Chris)
- 4cadd5e - feat(skills): add trm-closed-loop-research skill package (Chris)
- 3d3fb9a - feat(trm): complete live multi-notebook mining and Layer 2 wiki synthesis round-trip (Chris)
- 537e4ca - fix(docs): colocate diagram PNG with design spec for wiki publisher image resolution (Chris)
- 551d593 - docs: add Cathryn Lavery TRM gap triage architecture diagram and update documentation (Chris)
- e922d1c - docs: update TRM query expansion design spec with eng review decisions (Chris)
- ae49ae6 - docs: add TRM cognitive query expansion design spec (Chris)
- 0d1a9cc - feat(trm): add test suite for frontmatter validator and wire test:trm script (Chris)
- 4b03244 - docs(plan): add TRM frontmatter validator test suite implementation plan (Chris)
- 8468acf - docs(spec): add TRM frontmatter validator test suite design (Chris)
- d00f6c8 - fix: restore retro audit and toolforge health (Chris)
- 7282a7e - docs(report): add daily report for 2026-08-26 (Chris)
- d9ff50e - docs(wiki): synchronize Toolforge platform documentation, guides, and sidebar (Chris)
- 183e5eb - Merge branch 'main' of https://github.com/sorensencc-dotcom/toolforge into feat/openrouter-oxalpha-integration-2 (Chris)

## Version 1.1.0
Date: 2026-08-28

### Changes
- cfa6a81 - fix(ci): add root VERSION.md, claim DEV-001 in queue, and add paired wiki sync test (Chris)
- 715cc8b - feat(wiki): publish TRM DevOps Triage architecture diagram and specification page (Chris)
- e975ee3 - docs(skills): add Skill Operator Guide references to trm-devops-triage (Chris)
- d41dc2f - feat(skills): add trm-devops-triage skill with full toolforge specification (Chris)
- 3b89305 - chore(sync): update status feed and claude memory nodes (Chris)
- 015c422 - chore(mcp): register trm-devops MCP server in workspace config (Chris)
- 01a8334 - feat(trm-devops): initialize dev/triage queue state and gitignore (Chris)
- c514a92 - docs(status): record TRM DevOps sync and triage pipeline completion (Chris)
- 745aec9 - feat(trm-devops): implement MCP server adapter and tool handlers (Chris)
- f74fd33 - feat(trm-devops): implement CLI commands for sync, prune, and status (Chris)
- 7b2bab1 - feat(trm-devops): implement pruning manager and global index updates (Chris)
- f776eee - feat(trm-devops): implement queue reconciler and atomic markdown generator (Chris)
- 4dce7c8 - feat(trm-devops): implement offline fallback buffer and notebooklm client bridge (Chris)
- f2fa9ee - feat(trm-devops): implement schema validator and dead-letter chunk quarantine (Chris)
- ff2c4c9 - feat(trm-devops): implement concurrency file lock with stale recovery (Chris)
- 030aa5e - feat(trm-devops): implement error trace normalizer and signature hasher (Chris)
- 34dcde4 - feat(trm-devops): scaffold module package and core type interfaces (Chris)
- aabf570 - docs(plan): add TRM DevOps sync and triage pipeline implementation plan (Chris)
- eca1298 - docs(spec): embed simulation-verified normalizer transformation pipeline (Chris)
- b407309 - docs(spec): apply caveman review fixes (stale lock mtime, fallback mkdir, rawText notes, gz atomicity) (Chris)
- 0255311 - docs(spec): enhance TRM DevOps sync pipeline with fallback buffer, file locks, and lineage (Chris)
- 0b6f028 - docs(spec): add TRM DevOps sync and triage pipeline design spec (Chris)
- 5d30733 - feat(scripts): add on-demand TRM NotebookLM miner with daily status refresh (Chris)
- cc279c4 - Merge pull request #14 from sorensencc-dotcom/feat/viking-tier-index (Chris Sorensen)
- 316228c - docs(wiki): synchronize Toolforge platform documentation, guides, and sidebar (Chris)
- f54e02e - feat: pin viking reads to verified snapshots (Chris)
- f1b73ad - feat: derive viking tier freshness (Chris)
- a7f607c - feat: expose standard viking MCP resources (Chris)
- c0f67c6 - feat: integrate viking sqlite tier metadata (Chris)
- 5ac7056 - feat: add sqlite viking tier index (Chris)
- 2713b4a - fix: validate viking snapshot identities (Chris)
- 01ce33f - feat: add viking protocol contract validation (Chris)
- 0e8a65e - fix: enforce viking manifest containment (Chris)
- 667317c - feat: bind viking tiers to snapshots (Chris)
- 4215a7e - fix: emit valid viking JSON-RPC errors (Chris)
- c7ca6e8 - feat: validate viking MCP requests (Chris)
- 15df610 - feat: bound viking directory listings (Chris)
- 4d2f5fd - feat: enforce viking snapshot manifests (Chris)
- 04b44e4 - test: harden viking URI failure handling (Chris)
- 7ca1064 - feat: add read-only viking MCP filesystem (Chris)
- c2b18ad - chore: synchronize workspace agent instructions (Chris)
- 7c0e15e - chore: add fail-closed repository preflight (Chris)
- 32a9807 - docs: specify viking MCP virtual filesystem (Chris)
- 543b2e2 - test: add gate baseline profiler (Chris)
- 955c4a4 - chore: centralize shared agent instructions (Chris)
- ae0ddc1 - ci: onboard wave 3 governance repositories (Chris)
- 09657c0 - ci: add cross-repo governance gate matrix (Chris)
- 17aaca2 - fix(wiki-qa): resolve live wiki inventory slugs, frontmatter collision, and timeout budget (Chris)
- ab1fdaf - feat(governance): bridge TorqueQuery to agent dispatch (Chris)
- 0825b92 - Merge pull request #13 from sorensencc-dotcom/feat/openrouter-oxalpha-integration (Chris Sorensen)
- 887d16a - test(dispatch): verify bounded fallback artifacts and overrides (Chris)
- 9298b23 - test(agent-dispatch): cover contract signing and verification (Chris)
- d6f16d7 - feat(docs): enforce publishing inventory and wiki QA discovery (Chris)
- 044a7ba - fix: scope wiki browser QA link and diagram checks (Chris)
- 60c10a9 - fix(dispatch): enforce single-run trace isolation and truncation (Chris)
- bac8092 - fix(wiki): correct addFrontmatterTitle function call in copyRecursive (Chris)
- cc8d74f - docs(wiki): add WhichLLM hardware-aware evaluator spec and sanitize frontmatter (Chris)
- b5d36c2 - Merge pull request #2 from sorensencc-dotcom/feat/openrouter-oxalpha-integration (Chris Sorensen)
- b300148 - docs(wiki): synchronize Toolforge platform documentation, guides, and sidebar (Chris)
- 2eb1fbd - Merge remote-tracking branch 'origin/main' into feat/openrouter-oxalpha-integration-2 (Chris)
- 9dbb841 - fix(wiki): add trm-gap-triage-architecture diagram asset mappings to wiki publisher (Chris)
- 1136020 - chore(sync): update platform dashboard, journal, and skillpack metadata (Chris)
- 26ddc5a - docs(report): add daily report for 2026-08-27 (Chris)
- 4cadd5e - feat(skills): add trm-closed-loop-research skill package (Chris)
- 3d3fb9a - feat(trm): complete live multi-notebook mining and Layer 2 wiki synthesis round-trip (Chris)
- 537e4ca - fix(docs): colocate diagram PNG with design spec for wiki publisher image resolution (Chris)
- 551d593 - docs: add Cathryn Lavery TRM gap triage architecture diagram and update documentation (Chris)
- e922d1c - docs: update TRM query expansion design spec with eng review decisions (Chris)
- ae49ae6 - docs: add TRM cognitive query expansion design spec (Chris)
- 0d1a9cc - feat(trm): add test suite for frontmatter validator and wire test:trm script (Chris)
- 4b03244 - docs(plan): add TRM frontmatter validator test suite implementation plan (Chris)
- 8468acf - docs(spec): add TRM frontmatter validator test suite design (Chris)
- d00f6c8 - fix: restore retro audit and toolforge health (Chris)
- 7282a7e - docs(report): add daily report for 2026-08-26 (Chris)
- d9ff50e - docs(wiki): synchronize Toolforge platform documentation, guides, and sidebar (Chris)
- 183e5eb - Merge branch 'main' of https://github.com/sorensencc-dotcom/toolforge into feat/openrouter-oxalpha-integration-2 (Chris)

