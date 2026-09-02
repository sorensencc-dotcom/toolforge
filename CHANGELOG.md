# Changelog

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

