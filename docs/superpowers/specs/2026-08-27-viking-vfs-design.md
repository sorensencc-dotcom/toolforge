# Viking VFS design

**Status:** Approved design
**Date:** 2026-08-27

## Purpose

Expose the existing Three-Layer Vault through a read-only MCP resource protocol. The protocol reduces context transfer by allowing agents to request abstract, overview, or detail resolution without recursively loading raw sources.

The first slice is a retrieval lens over validated immutable snapshots. It does not write files, generate tiers during reads, resolve live workspace files, or serve multiple vaults in one process.

## Scope and invariants

- Expose `list`, `stat`, and `read` operations.
- Use a namespace-compatible URI grammar while bootstrapping one configured vault.
- Resolve all L2 details from an immutable timestamped staging snapshot.
- Treat filesystem manifests, snapshot identity, and recorded hashes as authoritative.
- Use SQLite only for indexed generated-tier metadata and freshness comparison.
- Reject foreign namespaces, traversal, unvalidated snapshots, missing manifests, and integrity mismatches.
- Never expose physical paths in responses.
- Never mutate vault, staging, cache, or source files.

## URI grammar

Canonical form:

`viking://<vault-name>/<layer>/<relative-path>`

Initial layer values are restricted to the validated staged projection of `sources`, `wiki`, and `schema`. The configured vault name is the only accepted namespace. An unqualified compatibility form may resolve to the configured vault, but all canonical responses include the vault name.

The parser must percent-decode safely, reject empty or ambiguous segments, normalize separators, reject absolute paths and traversal, and preserve a normalized URI for response identity.

## Resolution model

The resolver follows this sequence:

1. Parse and normalize the URI.
2. Validate the vault namespace against the single configured vault.
3. Select a complete timestamped staging snapshot.
4. Validate snapshot metadata and manifest membership.
5. Resolve the requested layer and relative path within the snapshot containment root.
6. Load the requested tier or metadata record.
7. Compare source identity with the generated-tier identity.
8. Return content and freshness metadata, or a stable error.

L0 contains directory/file abstracts for zero-hop relevance checks. L1 contains generated semantic wiki overviews. L2 contains raw source content from the same immutable snapshot. Reads never synchronously generate missing artifacts.

## Operations

### `list`

Input: `{ "uri": string }`

Output includes immediate child directories and files. Each file entry includes `name`, canonical `uri`, and its L0 abstract when available. Missing L0 is reported as `TIER_UNAVAILABLE`; the server does not synthesize an abstract.

### `stat`

Input: `{ "uri": string }`

Output includes `uri`, `size_bytes`, `last_modified`, category, verification status, SHA-256, snapshot ID, and tier availability. It returns metadata only and never returns file content.

### `read`

Input: `{ "uri": string, "resolution_tier"?: "L0" | "L1" | "L2" }`. Default tier is L1.

Output includes `uri`, `resolution_tier`, `snapshot_id`, `stale`, freshness metadata, and `content`.

`TIER_UNAVAILABLE` is a JSON-RPC error with no content. `TIER_STALE` is a successful response containing cached L0/L1 content and mandatory `stale: true` metadata. L2 is snapshot content and must be reproducible from the returned snapshot ID and hash.

## Stable errors

The server uses stable machine-readable identifiers:

`INVALID_URI`, `NAMESPACE_REJECTED`, `PATH_TRAVERSAL_REJECTED`, `SNAPSHOT_UNAVAILABLE`, `MANIFEST_INVALID`, `RESOURCE_NOT_FOUND`, `TIER_UNAVAILABLE`, and `INTEGRITY_FAILED`.

Error data includes the canonical or attempted URI, reason, and relevant snapshot/tier identifiers. It excludes physical paths and sensitive configuration.

## Components

- `uri-parser`: grammar, normalization, and namespace checks.
- `snapshot-resolver`: complete timestamped snapshot selection.
- `manifest-validator`: manifest membership and snapshot validation.
- `tier-resolver`: L0/L1 artifact lookup and snapshot-backed L2 reads.
- `integrity-checker`: SHA-256 and generation-identity comparison.
- `mcp-entrypoint`: operation registration and JSON-RPC error mapping.

These boundaries should remain independently testable. Existing configuration, staging validation, path-normalization, and wiki mapping contracts should be reused through thin adapters.

## Security and failure behavior

The server is read-only and fail-closed for namespace, containment, snapshot, manifest, and integrity failures. It must not follow a path outside the selected snapshot root, trust client-supplied physical paths, or fall back to live workspace files.

Generated tiers are nightly-run artifacts. A missing tier returns `TIER_UNAVAILABLE`. A changed source identity paired with an otherwise valid cached L0/L1 artifact returns the cached artifact with `stale: true`; the response must expose both source and compiled timestamps or hashes.

## Acceptance tests

Focused tests must cover valid and malformed URIs, namespace rejection, traversal, missing and incomplete snapshots, invalid manifests, hash mismatches, unavailable tiers, stale responses, fresh responses, reproducible L2 reads, MCP envelopes, stable error codes, and zero filesystem mutation.

Validation must distinguish focused protocol tests from full-suite, live-service, and production evidence. Token measurements should compare recursive raw loading with L0/L1 escalation using the same task corpus and report request counts, input tokens, and L2 escalation rate.

## Evolution path

Future governed annotations and live workspace access are separate designs. A future `/live/` layer may be added only with explicit authorization, audit, conflict, and containment contracts. A user-space filesystem mount may become an adapter over this MCP protocol; it is not part of the first slice.
