# TRM Data Governance — Design Spec

Status: approved (design phase) — 2026-07-18

## 1. Problem

The first live TRM instance (`charlie-deep-research/trm-data`) was created inside a git working tree whose remote (`charlie-deep-research` on GitHub) is **public**. The data sat there untracked (gitignore-reliant), one `git add -A` away from exposing real family names, FOIA claim numbers (`CU-2067`, `CU-6188`), and unverified genealogy research to a public repo. Caught before any push happened, not by tooling — by manually checking `gh repo view` before pushing. That's not a repeatable safety margin.

This spec fixes the underlying problem: TRM topic data must never depend on a human remembering a `.gitignore` rule to stay private.

## 2. Vault location

TRM topic data lives at `C:\Users\soren\trm-vault` — a directory tree with no git repository anywhere above it in the filesystem, except the vault's own (see §3). This makes "which repo is this inside, and is it public" a non-question: there is no enclosing repo to accidentally stage the data into.

`trm-vault/config.json` is the standard TRM config (per the base spec §2.1); `trm-vault/topics/` holds all TRM nodes, same structure as any other TRM root.

## 3. Versioning

`git init` is run inside `trm-vault` itself. This gives real version history (`git log`, `git diff`, rollback) layered on top of TRM's own per-node `lineage.json` operation log — the two serve different purposes: lineage.json is TRM's own hash-chained governance record (§7 of the base spec), git history is ordinary file-level version control for browsing/reverting.

**No remote is configured, ever, by default.** Adding one later (e.g. a private GitHub repo for off-machine backup) is a deliberate future decision, not something this spec authorizes — if it happens, it must be revisited explicitly, including re-checking the guardrail in §5 still holds (a private remote is safer than public, but "private today" is not a permanent guarantee either).

## 4. Promotion boundary

No new tooling. `trm crosslink --treatment-sections ...` already writes `crosslinks/treatment.json` as a write-only pointer inside the TRM node (base spec §3.6, §7) — that behavior is unchanged. The boundary between "private vault" and "public Treatment Draft" stays a manual, human-mediated step: a person reads the promoted facts and decides what, if anything, and in what form, gets written into the actual (git-tracked, public) treatment documents. Nothing in TRM automates or shortcuts that copy.

## 5. Tool-enforced guardrail

A new check, `assertSafeRoot(root)`, added to `trm/src/core/rootSafety.ts`:

- Walks up from `root` looking for a `.git` directory.
- If found, reads `.git/config` for a `[remote "...."]` section.
- If any remote is configured, throws an `Error` refusing to proceed — the message names the repo path and instructs the operator to either move the data or set `TRM_ALLOW_GIT_ROOT=1` to override.
- If `.git` is found with **no** remote configured (matches the vault's own setup, §3), or no `.git` is found at all walking up to the filesystem root, the check passes silently.
- `TRM_ALLOW_GIT_ROOT=1` env var bypasses the check entirely — an explicit, deliberate opt-out, not a default.

Called exactly once, in `trm/src/cli/index.ts`, immediately after `const root = process.cwd();` and before `program.parse()`. This covers every CLI command uniformly (`create`, `ingest`, `extract`, `score`, `crosslink`, `version-bump`, `validate`) without needing to thread the check through each command function individually — `root` is always `process.cwd()` at the CLI layer, never a per-command argument (the underlying `run*` functions take `root` as an explicit parameter for testability, per the base spec's design, and are unaffected — their existing unit tests use `fs.mkdtempSync` tmpdirs with no `.git` anywhere above them, so `assertSafeRoot` sitting only in `index.ts` never touches those tests).

## 6. Migration of existing data

`charlie-deep-research/trm-data`'s current contents (`charlie/cuba`, 7 sources, 85 facts, built across this session) move to `trm-vault/topics/charlie/cuba` as part of implementation, then the untracked copy in `charlie-deep-research` is deleted entirely. Since that copy was never committed, deleting it loses no git history — it simply removes the last copy of that data from a repo it should never have been in.

## 7. Explicitly excluded from this pass (YAGNI)

- Automated redaction or PII scanning of promoted facts — the manual promotion boundary (§4) is the control for now; an automated scanner is a future enhancement if the manual step proves error-prone in practice, not a day-one requirement.
- Off-machine backup strategy for the vault — deliberately deferred (§3); the vault existing at all, versioned locally, is the improvement this spec delivers. Backup is a separate decision with its own tradeoffs (which remote, encryption, access control) that shouldn't block shipping the guardrail.
- Multi-user/multi-machine vault sync — single-operator, single-machine assumption, consistent with the base TRM spec's existing exclusions (§9 of the base spec: no multi-actor locking, no multi-repo coordination).

## 8. Known discrepancy vs practice so far

The base TRM spec (§2) describes `root` as an explicit parameter with no assumption about its relationship to git. This spec adds a constraint on top: `root`, when reached via the CLI (not via direct function calls in tests or other tooling), must not resolve inside a git repo with a remote. This is additive, not a contradiction — direct programmatic use of the `run*` functions (as all existing unit tests do) is unaffected; only the `trm` CLI binary itself gains the check.
