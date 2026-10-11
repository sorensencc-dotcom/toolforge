# Read-Only Pilot Acceptance

Operational evidence, 2026-10-10. Product head 903c4436; documentation-only delivery updates follow it.

Supported input-aware pilots: roadmap-validator, agent-drift-detector, retro-schema-validator. Other skills retain existing CLI/instructions behavior; no all-skill adapter rollout.

- Managed contracts/worker/CLI plus Retro: 47/47, zero skips.
- Original Roadmap local Jest: 18/18. Original Agent local Jest: 2/2.
- Matching ICF product 3b2e70f: full 151/151 (87 reporting + 64 gateway), zero skips; acceptance checkpoint269d83e.
- Independent task reviews and final scoped re-review clean after fixes. Fifteen reviewed source pins match; anchor SHA-256 e93d685b466750a29471df2991491dc841585987d819cc92b3a292c8be83eb51. Eight disposable fixture hashes/listing unchanged.
- BrowserOS Neo verified both ICF surfaces, all three actual forms and actual clipboard families, native execution samples, cancellation/stale-state cleanup, unavailable fallback, focus wrapping, Retro 32-file bound, desktop/mobile layouts, and eight final wiki-owner payloads. No mutating production command executed.

See [operator contract](USAGE.md) for exact runtime/input/output/permission limits. Complete cross-repository findings and live evidence are in ICF docs/superpowers/acceptance/2026-10-10-toolforge-read-only-pilot.md on its matching pilot branch.

Verification used installed local Jest dependencies, in-memory ICF reporting, verified unchanged sandbox telemetry siblings, and synthetic fixtures. No downloads or canonical data changes. Preview Agent/Retro clipboard commands were formatter-verified, not separately executed; other pilot command execution samples are recorded in ICF evidence. Default persistent reporting deployment and production integration not proven.

Human authorized push/PR on 2026-10-10. Scoped Toolforge PR base parkd821-20260908; matching ICF base fix/dashboard-docs-button-8001. Worktrees preserved. No merge, deployment, canonical server restart, or real mutating wiki/bot/task execution authorized. QA server roots currently cover synthetic fixtures only. Fingerprints/Node permissions are not an OS sandbox and do not protect against replacement of both source and trust anchor or hostile concurrent filesystem mutation.

## Approved Security-Gate Remediation

Initial push blocked on intentional pilot spawn import and existing parallel-search shell launcher. Human explicitly approved scoped remediation and requested tests. No hook, scanner rule, upstream scope, or security policy changed. Pilot import now carries documented existing SEC-AUDITOR exception for fixed bounded worker; execution logic unchanged. Explicitly reviewed source pin and consumer anchor updated to SHA-2565a0873f6cf6b8f157490318ab9873810dcba09f2be267ad964372d3140ad639a; earlier digest above is historical acceptance evidence.

Parallel launcher now invokes installed tsx/cli through process.execPath with shell:false and literal arguments, without npx/download fallback. Six subprocess regressions prove filenames, missing runtime/tests, count threshold, native failure and signal behavior. Added pilot regression captures actual spawn executable, fixed worker, flags, options and restricted environment. Both affected skills pass unchanged security auditor; full suite and remote delivery status recorded in matching ICF acceptance report.

## Prior Delivery Blocker (Historical)

Code head9519353c: launcher6/6 plus original non-live35/35, managed/Retro48/48, full matching ICF151/151; zero skips. Full unchanged pre-push hook still blocks on three baseline files unchanged by pilot/remediation: skills/slop-grader-sweep/src/file-list.ts, skills/slop-grader-sweep/src/slop-grader-runner.ts, skills/trm-devops-triage/src/index.ts. No Toolforge remote branch or PR exists; these local operator/acceptance docs are not remotely published yet. Further skill remediation needs separate approval. No hook/scanner/upstream scope changed.

ICF original [PR4](https://github.com/sorensencc-dotcom/icf/pull/4) merged externally; matching anchor/docs [follow-up PR7](https://github.com/sorensencc-dotcom/icf/pull/7) targets now-current codex/weekly-retro-reporting baseline. Do not deploy updated anchor without matching reviewed Toolforge source; mismatch fails closed. Fresh independent remediation reviewer hit usage limit, no verdict; controller reviewed scoped diff and fingerprints. No controller merge/deploy/canonical restart performed.

## Remaining Audit Findings Remediated - 2026-10-10

Human GO authorized three remaining baseline findings. TRM wrapper's shell command construction removed: fixed current Node and local built CLI, literal argument arrays, shell:false, supported-command guard and missing-build failure. No npx/download fallback. Slop fixed Git diff and installed-grader subprocesses now explicitly shell:false with documented existing auditor exceptions; no provider/runtime permission expansion.

TRM six new regressions failed against original wrapper then full17/17 passed, including real disposable-child literal argv. Slop three intended assertions failed then full offline51/51 passed. Tests preserve commands, missing build, native errors and hostile filenames/cwd. Existing TypeScript compiler from installed Slop toolchain compiles TRM wrapper in test VM; fake CLI only, not production triage. Both affected skills pass unchanged auditor. Pilot fifteen pins and anchor5a0873f6cf6b8f157490318ab9873810dcba09f2be267ad964372d3140ad639a unchanged by this wave.

Earlier blocker paragraphs describe prior checkpoint, not current target-auditor results. Normal full pre-push gate, remote branch/PR state and review verdict are recorded separately in delivery PR. No hook/scanner/upstream manipulation, real grading/provider spend, production sync/prune, merge or deployment.

Fresh scoped reviewer PASS for final Slop/TRM source/tests/docs; no fix-induced defects found. Reviewer did not rerun suites/builds/live actions; counts above are controller evidence. Original remote parkd821-20260908 baseline moved during delivery: it no longer contains de310f24 and three-dot PR diff expands to364 files of unrelated history. Do not treat changed baseline as reviewed integration target. Scope-preserving remote target decision requested; local fixes/ledger preserved, no force push or oversized PR.
