---
title: "Delivery guard adapter contract"
document_id: "CIC-DELIVERY-GUARD-README"
category: "readme"
type: package-documentation
status: "active"
version: "0.5.0"
---

# Delivery guard adapter contract

Repository adapters provide a strict configuration object to
`validateAdapterConfig`:

```js
{
  repository: { id: 'repo-name', root: '.' },
  generatedPaths: ['.ijfw/**', 'dist/**'],
  automationPaths: ['.github/workflows/**', 'scripts/**'],
  testCommands: ['npm test'],
  trustedExemptionAuthorities: ['tier-1'],
  hookInstaller: {
    command: 'node scripts/setup-git-hook.mjs',
    installedPath: '.git/hooks/pre-commit'
  }
}
```

Path values are repository-relative and cannot traverse to a parent. Generated
and automation path lists, test commands, trusted exemption authorities, and
hook installer fields are required. The validator returns original configuration
when valid and throws `AdapterConfigError` with structured `issues` when invalid.

## Public API

`src/index.js` exports:

- `validateAdapterConfig(config)` validates complete adapter contract.
- `classifyDiff(entries, adapter, options)` classifies authored and generated paths.
- `evaluateAutomationTestPolicy(entries, adapter, options)` applies paired-test and exemption policy to one change set.
- `evaluateCiAutomationPolicy(entries, adapter, options)` converts one policy result into blocking or advisory enforcement.
- `evaluateCiCommitPolicies(changeSets, adapter, options)` evaluates every commit independently and enforces same-commit pairing.
- `runConfiguredTestCommands(adapter, options)` executes every configured focused test command and records exit status.
- `parsePushManifest(manifestInput, options)` parses single-repository default or multi-repo manifests.
- `sanitizeReceiptData(data)` redacts credentials, tokens, and strips prompts or raw text.
- `getDefaultReceiptStoragePath()` resolves the user-level JSONL receipt log file.
- `writePushReceipt(receipt, options)` appends sanitized receipts to user-level storage outside repositories.
- `executePushWithReceipt(pushSpec, options)` runs push operations, captures post-push `git status --short --branch`, and writes receipts.
- `createBudgetLedger(options)` creates a durable event-sourced budget ledger.
- `BudgetLedger` manages grants, reservations, settlements, and releases.
- `getDefaultLedgerStoragePath()` resolves default user-level budget ledger storage path.
- `createGuardedProvider(provider, options)` wraps provider dispatch with atomic budget reservation and release.
- `estimateModelCost(query, modelRegistry)` computes conservative pre-dispatch cost estimates.
- `normalizeModelId(modelId)` canonicalizes model names by stripping provider prefixes and lowercasing.
- `buildNormalizedModelMap(modelRegistry)` constructs normalized registry maps with alias collision validation.

`classifyDiff` also exports `DiffEntryError` and `UnsupportedGlobError`.
`validateAdapterConfig` also exports `AdapterConfigError`.
`parsePushManifest` also exports `ManifestError`.
`BudgetLedger` also exports `LedgerError`, `BudgetExhaustedError`, `ReservationNotFoundError`, `ReservationStateError`, and `ReservationAlreadySettledError`.
`createGuardedProvider` also exports `GuardedProviderError`, `UnknownModelError`, and `ModelRegistryConflictError`.

## Automation test policy

Automation destination must ship with added, copied, modified, renamed, or
untracked regression-test destination in same commit. Deleted tests never
satisfy policy. For renames, only destination path counts; renaming test into
documentation does not satisfy policy.

Authoritative CI evaluates each commit between base and head. Test file in
different commit does not cover automation change. When GitHub supplies
all-zero `github.event.before` for first push, wrapper evaluates empty-tree to
head as root diff. If eligible automation and test destinations exist, CI runs
every `testCommands` entry and blocks on command failure. Local staged hook uses
advisory mode and does not replace CI.

## Trusted exemption input

Raw reason strings are not accepted. Pass `--trusted-exemptions-file` with JSON
file outside repository checkout. Protected CI or human operator must create
file; pull request cannot self-author it inside checkout. Schema:

```json
{
  "version": 1,
  "exemptions": [
    {
      "commitSha": "full-commit-sha",
      "authority": "tier-1",
      "approver": "approver identity",
      "reason": "auditable reason",
      "approvalRef": "immutable approval record reference",
      "signature": "hex HMAC-SHA256 signature"
    }
  ]
}
```

`authority` must match `trustedExemptionAuthorities`. Exemption applies only to
matching commit SHA. Policy output preserves approver, reason, and approval
reference for audit. Protected CI supplies
`DELIVERY_GUARD_EXEMPTION_HMAC_KEY`; wrapper rejects missing, malformed, or
incorrect signatures. Signature payload joins file version, `commitSha`,
`authority`, `approver`, `reason`, and `approvalRef` with newline characters in
that order.

## Durable budget ledger

`BudgetLedger` provides append-only event-sourced provider economics tracking:

- `grantBudget({ amount, reason })` deposits funds into the ledger.
- `reserveBudget({ amount, reservationId, provider, model })` atomically checks and reserves budget under file-lock concurrency protection. Throws `BudgetExhaustedError` on insufficient balance.
- `settleReservation({ reservationId, actualCost, metadata })` finalizes spend and automatically refunds unused reserved amount to available balance.
- `releaseReservation({ reservationId, reason })` cancels a pending reservation and returns full reserved amount.
- Replays event log on restart, skipping malformed lines safely.

## Provider dispatch guard

`createGuardedProvider(provider, { ledger, modelRegistry, providerName })` wraps LLM providers:

- Computes conservative pre-dispatch cost estimate via `estimateModelCost(query, modelRegistry)`.
- Fails closed with `UnknownModelError` (`UNKNOWN_MODEL`) before dispatch if model is not registered.
- Free/local models (`isFree: true` or zero rate card) bypass ledger reservation.
- Paid models atomically reserve estimated cost before network dispatch. If exhausted, blocks dispatch with 0 network calls.
- On dispatch success, settles reservation with actual usage cost; overruns are recorded in ledger metadata for accounting reconciliation.
- If settlement fails, throws `GuardedProviderError` (`SETTLEMENT_FAILED`) with attached result payload.
- On dispatch failure, automatically releases reserved funds back to ledger balance.

## Scoped push receipts

Push operations record post-push repository state (`git status --short --branch`)
to append-only JSONL logs outside checkout (default: `~/.delivery-guard/receipts.jsonl`).
Secrets, access tokens, and prompt text are stripped before serialization.

Run via CLI:
```text
push-with-receipt.mjs [--manifest <path>] [--storage-path <path>] [--dry-run] [push-args...]
```

## CI wrapper

Run one input mode:

```text
evaluate-automation-policy.mjs --paths-file <path>
evaluate-automation-policy.mjs --staged [--advisory]
evaluate-automation-policy.mjs --base <ref> --head <ref> [--run-tests]
```

Any mode can receive `--trusted-exemptions-file <outside-checkout-path>`.

## Generated-path glob grammar

`generatedPaths` accepts repository-relative patterns using this complete grammar:

- `/` separates path segments; `\` is normalized to `/` for Windows adapters.
- `*` matches zero or more characters within one segment.
- `?` matches exactly one character within one segment.
- `**` matches zero or more characters across segments. A `**/` sequence also matches zero or more complete directory segments.
- All other characters match literally.

Character classes (`[]`), brace expansion (`{}`), extglob (`!()`, `?()`, `+()`, `*()`, and `@()`), alternation (`|`), anchors, escapes, absolute paths, and parent traversal are unsupported. The classifier rejects any configured pattern containing unsupported syntax before examining paths, so unsupported patterns cannot silently classify generated files as authored.
