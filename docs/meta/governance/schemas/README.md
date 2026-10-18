# Governance schemas

Machine-readable schemas referenced by candidate and approved governance
artifacts. Schema changes require review under the governing artifact's
approval path.

- `provider-receipt-v1.schema.json` — candidate provider invocation receipt
  schema referenced by `provider-policy-v1.0.md`.
- `retro-inbox-v1.schema.json` is the draft retro inbox entry schema that
  `.context/retros/INBOX-SPEC.md` and `retro-policy.md` reference.
  `node scripts/validate-retro-inbox.mjs --write-schema` generates it from
  `INBOX_REGISTRY`, so change the registry instead of this file.
