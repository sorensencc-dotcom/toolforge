---
title: "Delivery guard adapter contract"
document_id: "CIC-DELIVERY-GUARD-README"
category: "readme"
type: package-documentation
status: "active"
version: "0.2.0"
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

`classifyDiff` also exports `DiffEntryError` and `UnsupportedGlobError`.
`validateAdapterConfig` also exports `AdapterConfigError`.

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
