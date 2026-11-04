# TRM card-intake clean cards

## a. Body extraction

Met.

- Added a fixture-backed `.gdoc` regression with no network or real Drive access.
- Failed or filename-only bodies return `BODY_EXTRACTION_FAILED` and quarantine through the existing intake path.
- Lowercase `mobile-gemini-gdoc` pointer cards no longer pass as actionable filename metadata.
- Evidence: `intake quarantines a failed lowercase mobile-gemini-gdoc body extraction fixture`; 10/10 focused tests passed.

## b. Acceptance criteria

Met.

- Cards without real criteria, or containing only the generic staging/promotion defaults, return `NO_ACCEPTANCE_CRITERIA`.
- Staging and promotion reject before scaffold generation or GitHub invocation.
- Evidence: `validator rejects generic acceptance defaults with NO_ACCEPTANCE_CRITERIA`; `staging rejects cards without real acceptance criteria before generating a scaffold`; ingress suite 37/37 passed.

## c. Duplicate IDs

Met.

- ID comparisons are case-insensitive.
- Intake, staging, and promotion reject duplicate IDs with `DUPLICATE_ID`.
- Evidence: duplicate validator, staging, and promotion tests; focused intake/promotion run 21/21 passed.

## d. Repository mismatch

Met.

- Issue URL repository, explicit repository fields, and target/domain/notebook routing must agree.
- Mismatches return `REPO_MISMATCH` before promotion or issue creation.
- Evidence: `validator rejects inconsistent issue, repo, and target routing with REPO_MISMATCH`; `promotion rejects a repository-mismatched card before calling GitHub`.

## Verification

- RED: the new test file failed before implementation because `validateCardIntegrity` was not exported.
- `node --test --test-timeout=10000 tests/trm-intake-clean-cards.test.mjs tests/promote-card.test.mjs`: PASS, 21/21.
- `node --test --test-timeout=10000 tests/trm-ingress-routing.test.mjs`: PASS, 37/37.
- Existing `tests/promote-card.test.mjs`: PASS, 11/11 in the combined focused run.
- `tests/trm-hardened-gates.test.mjs`: not runnable in this worktree because its pre-existing import targets the absent sibling `icf/src/server.mjs`; no ICF checkout was edited.
- `npm test -- --test-timeout=10000`: attempted offline with a 60-second bound; still running unrelated tests at the bound and was stopped. No final full-suite result is claimed.

## Delivery

- Test commit: `test(trm): cover clean card intake gates`.
- Implementation commit: `182bff78 fix(trm): reject dirty mobile action cards`.
- Follow-up: `27a5ff0a fix(trm): preserve intake gate ordering`.
- No push, PR, merge, ledger edit, real inbox edit, Drive edit, scheduled-task change, or `_status-feed` edit.
- ICF was not changed; no separate ICF fix was required.
