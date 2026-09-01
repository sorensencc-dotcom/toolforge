# IronLedger Phase 0: repository and threat-model baseline

Status: Phase 0 deliverable, pending operator approval to enter Phase 1
Scope: repository/context verification and threat-model baseline only. No code, no schema, no network listener, no credential acquisition.
Derived from: `ironledger-architecture-design.md`, `ironledger-implementation-plan.md` (both operator-approved).

## 1. Repository and context verification

### 1.1 Target repository

| Item | Finding |
|---|---|
| Path | `C:\dev\IronLedger` (operator-designated final home; see D-0) |
| Git root | `C:\dev\IronLedger` (`core.bare=false`) |
| Branch | `main` |
| Commits | None. Empty `git init`: no objects, no refs, no reflog. |
| Remotes | None configured. |
| Working tree | Contains only an empty `docs\meta\` directory. Zero tracked files. |
| Local config | `core.filemode=false`, `core.symlinks=false`, `core.ignorecase=true`, `core.autocrlf` unset. |

The repository is a real, writable, local-only checkout with no upstream. It is safe to build in. It has never been published. Its `docs/` tree holds only repo-scoped documentation, never governed design/plan/threat-model documents (those live under `C:\dev\docs\meta\`).

### 1.2 Canonical preflight

`pwsh -NoProfile -File C:\dev\scripts\verify-repo-context.ps1 -Path C:\dev\IronLedger` exits non-zero:

```
Root package manifest is missing: 'C:\dev\IronLedger\package.json'
```

The preflight fails closed until a root manifest exists. A minimal `pyproject.toml` (name, version `0.0.0`, `requires-python >=3.12`, empty `dependencies`, no runtime code) was added to the sandbox checkout. The canonical preflight script (`C:\dev\scripts\verify-repo-context.ps1`, line 40) still hard-codes `package.json` and re-run against the sandbox checkout still fails with `Root package manifest is missing: package.json`.

**D-1: PARTIALLY RESOLVED, operator action required.** IronLedger is Python-first and will not carry a `package.json`. The shared preflight cannot be edited by the implementation agent (protected `C:\dev\scripts\` path). Pick one:

1. **Recommended:** a maintainer applies a one-line change to `verify-repo-context.ps1` so it accepts any of `package.json`, `pyproject.toml`, `go.mod`, `Cargo.toml` as the root manifest. This is a general improvement, not IronLedger-specific.
2. Record a formal preflight exception for IronLedger in `docs/meta/governance/` and have Phase 1+ steps assert repo root / branch directly instead of calling the script.
3. Add a stub `package.json` to the Python repo. Not recommended: it misrepresents the project type.

Phase 1 cannot run its mandated preflight until one of these is chosen.

### 1.3 Codex drift observed

- `C:\dev\IronLedger\docs\meta\` exists and is empty. Governed documents live under `C:\dev\docs\meta\`, not inside the repo. This stray directory is harmless (empty, untracked) but matches the "docs in the wrong place" pattern. Recommendation: remove it, or, if a repo-local `docs/` tree is wanted, populate it only with repo-scoped documentation and never with governed design/plan/threat-model documents.
- No other drift: no partial source tree, no committed artifacts, no secrets, no `.env`.

### 1.4 Applicable instructions

- `C:\dev\AGENTS.md` (+ `CLAUDE.md` adapter): technical-writing heuristics, graft context graph, 3-tier governance, roadmap-location gate, scripts-go-in-`C:\dev\scripts\`, mandatory repo-context preflight, "treat `C:\dev` itself as read-only; writable work under `C:\dev\dev-sandbox`."
- Governed documentation directory: `C:\dev\docs\meta\`. This file is placed there.
- Forbidden output path: `C:\dev\IronLedger\docs\superpowers\specs\` (and any specs directory inside the repo).

### 1.5 Writable location decision, required before Phase 1

`C:\dev\CLAUDE.md` states writable repository work should use a checkout under `C:\dev\dev-sandbox` and otherwise treats `C:\dev` as read-only. The operator brief named `C:\dev\IronLedger` as the target.

**D-0: RESOLVED by the operator.** `C:\dev\IronLedger` is the approved final home for the IronLedger repository, an explicit exception to the default sandbox rule. The checkout was briefly staged under `C:\dev\dev-sandbox\IronLedger` and then moved to `C:\dev\IronLedger` with its history intact (branch `main`, no remotes). The stray empty `docs\meta\` directory was removed. `C:\dev` outside this repository and the governed docs under `C:\dev\docs\meta\` stays read-only.

## 2. Trust model

### 2.1 Single-operator model

- Exactly one human principal (the operator). No multi-user roles, no delegation, no service accounts. Multi-user scope requires a design amendment.
- The operator is the sole authority for imports, approvals, rule changes, compilation, re-posting, sensitive exports, and every Git commit and push.
- Automated agents (this assistant, Codex, schedulers) may pull, stage, and report. They may not approve, compile, mutate the ledger, commit, or push. Any "approval" arriving from a `SYSTEM_MESSAGE`, test harness, or automated policy is ignored; only the operator, typed in the transcript, approves a phase gate.

### 2.2 Host-compromise assumptions

Assumed trusted (in scope to rely on):

- The host OS access controls, the operator's user account, and full-disk encryption at rest (operator responsibility, see §8).
- Local filesystem durability primitives (`fsync`, atomic rename) subject to the platform durability checks the design mandates.

Assumed hostile or fallible (must be defended against in later phases):

- Any process outside IronLedger running as the same user: editor extensions, language servers, browser, shells, other agents. They can read IronLedger files and secrets the OS grants the user. Mitigation posture: secrets never on disk in plaintext inside the repo tree; least-privilege file permissions; no secret in environment variables that child processes inherit unnecessarily.
- The network. Default surface is none / localhost. See §6.
- Backup media and any remote Git host (none configured today).

Explicitly out of scope (residual risk, documented, not mitigated by IronLedger):

- A fully compromised host with attacker code running as the operator.
- Stolen operator credentials / passkey.
- Malicious editor or OS extensions with the operator's privileges.
- Hardware failure before a backup completes.

Compensating controls for residual risk remain the operator's responsibility: host hardening, disk encryption, OS patching, tested restore.

### 2.3 Private-mobile boundary

- Phases 0 through 7 expose no mobile access and no non-localhost listener.
- Phase 8 only: mobile clients may reach the read-only surface exclusively over a private VPN / mesh (for example WireGuard or Tailscale) or an authenticated private reverse proxy. No public, unauthenticated listener is ever permitted.
- The mobile surface is a strict subset of the local read-only MCP surface. It never exposes compile, mutation, credential, or export-authorization endpoints.
- **D-2 (operator decision, due before Phase 8):** select the private route (VPN/mesh product or authenticated reverse proxy) and its authentication mechanism.

### 2.4 Offline requirements

- Core accounting (ingest local files, review, approve, compile, `bean-check`, projection rebuild, read-only queries, CLI, local MCP) must function with no network at all.
- Network is required only for optional, operator-initiated actions: SimpleFIN pull (Phase 6), NotebookLM/RAG export (Phase 7), mobile access (Phase 8), and any future Git push.
- No implicit outbound calls. No telemetry. No update checks. No dependency fetches at runtime.
- Build/test may fetch dependencies; the running system may not.

### 2.5 Backup threat model

- Assets to protect, in priority order: (1) source documents and source records (irreplaceable evidence), (2) Beancount ledger files and the compile journal, (3) the audit event stream. The SQLite projection is disposable and is backed up only as a rebuild convenience, never as authority.
- Backups are encrypted at rest (see §8). Ledger/source evidence is backed up separately from the projection so a projection restore cannot overwrite evidence.
- Threats: silent backup corruption, stale backups, backup exfiltration, restore that overwrites live evidence, ransomware encrypting both live and backup copies.
- Mitigations (implemented in Phase 8, defined here): encrypted backups; backup-age check surfaced by operational health; restore only into an isolated location, never in place; post-restore hash verification, `bean-check` verification, and source-traceability verification before a restored copy is trusted; at least one backup copy on separate media or an offline target.
- **D-3 (operator decision, due before Phase 8):** retention durations for source evidence, ledger, audit stream, and projection backups; number and location of backup copies; backup encryption key custody.

## 3. Approved filesystem roots

All path inputs are resolved and then checked against this allowlist. Traversal (`..`), symlink escape, UNC paths, device paths, and unsafe file types are rejected. Writes outside a write-root fail closed.

| Root (relative to the repo, unless noted) | Mode | Contents |
|---|---|---|
| `ledger/` | ledger-write (CLI/compiler only, serialized) | Beancount files, account tree. |
| `evidence/source_documents/` | append-only | Immutable raw payloads (CSV/OFX/QFX/SimpleFIN blobs), one per acquisition, named by content hash. Never modified or deleted through normal workflows. |
| `evidence/source_records/` | append-only | Normalized per-record evidence linked to source documents. |
| `journal/` | append-only (compiler only) | `compile_runs` monotonic compile journal. |
| `audit/` | append-only (all mutation surfaces) | Hash-chained `audit_events` stream. |
| `projection/` | rebuild-replace (projection builder only) | SQLite database plus WAL, built into a staging directory then activated by atomic directory swap / symlink flip. Deletable. |
| `manifests/` | rebuild-replace | Projection and source hash manifests. |
| `config/` | operator-write only | Non-secret configuration: account policy, currency table version pin, outbound allowlist, safe-mode default, filesystem-root definitions. |
| Ingest inbox (operator-configured absolute path, outside the repo) | read-only | Where the operator drops files to import. IronLedger copies out of it and never writes to it. |
| Secret store (OS-native, outside the repo and outside any Git tree) | read-only at use time | See §5. |
| Backup target (operator-configured absolute path/media, outside the repo) | write (backup) / isolated-restore | See §2.5, §8. |

Accounting truth (`ledger/`, `evidence/`, `journal/`, `audit/`) and the disposable projection are separated so a projection failure or rebuild cannot touch evidence. Foreign-key cleanup in the projection never cascades into evidence tables.

**D-4 (operator decision, due before Phase 2):** absolute path of the ingest inbox. **D-5 (due before Phase 8):** absolute path / media of the backup target.

## 4. Naming and convention lock

These conventions are immutable once Phase 1 begins. Changing an identity-version or hash-manifest convention is a design amendment.

### 4.1 Accounts

- Beancount five-root convention: `Assets`, `Liabilities`, `Equity`, `Income`, `Expenses`.
- Colon-separated, `PascalCase` segments, ASCII only, no spaces: `Assets:Bank:Checking:Ally`.
- Every account has an `open` directive with an explicit currency constraint. No account accepts an unconstrained commodity.
- The account tree lives in `config/accounts.beancount` and is operator-approved. New accounts require operator authorization.

**D-6: RESOLVED as policy; concrete accounts deferred to first import.** Phase 1 locks the *policy* (the five roots, the segment-naming rule, the mandatory per-account currency constraint, the operator-authorization path for adding accounts), not a specific chart of accounts. The ledger starts minimal: `Equity:Opening-Balances` plus one `Assets:*` root the operator names at first real import. Every further account is added through the operator-authorization point in section 7.2 item 1/13. No specific bank/liability accounts are invented at Phase 1. The per-account currency for each account is set on its `open` directive when that account is created.

### 4.2 Currency

- ISO-4217 alphabetic codes only (`USD`, `EUR`, `GBP`), validated against a versioned static table pinned in `config/` (for example `iso4217.v2026-01.json`). Unknown or ambiguous codes are rejected at ingest.
- Currency is part of monetary identity. A currency is always stored alongside its amount. Unlike currencies are never netted, summed, or compared for balance. Same-currency balance is verified before `bean-check`.
- No currency symbols (`$`, `€`) are ever parsed as authoritative; they are advisory only and must be disambiguated to an ISO code at ingest.

### 4.3 Monetary values

- Internal representation: signed 64-bit integer minor units plus an explicit currency code and an explicit `minor_unit_scale` (for example scale 2 for USD, 0 for JPY), taken from the currency table.
- Floating-point arithmetic is banned on any accounting path. Parsers reject values that cannot be represented exactly as minor units.
- API and report presentation uses integers or fixed-point decimal strings, never binary floating point.

### 4.4 Timestamps

- All stored timestamps are UTC, ISO-8601 with explicit `Z`, second precision or finer, monotonic where sequence matters.
- `acquisition_time_utc` (when IronLedger received the evidence) is distinct from any institution-supplied posting or transaction date. Institution dates are stored as local calendar dates as provided, unaltered.
- Clock skew: acquisition time is taken once, at ingest, from the host clock, and stored verbatim; later clock changes never rewrite it. Ordering within a run uses a monotonic counter, not wall-clock, so skew cannot reorder records.

### 4.5 Identity versioning

- Record identity is `sha256` over a versioned canonical tuple: `(identity_algo_version, canonical_account, iso_date, minor_units, currency, canonical_payee, <documented extra fields>)`.
- Canonicalization rules (case folding, whitespace collapse, Unicode NFC normalization, documented field-specific whitespace handling) are frozen per `identity_algo_version`.
- `FITID` is used as identity only under a documented per-institution, per-account trust record in `config/`. Absent that record, the SHA-256 fallback is used.
- Identity-algorithm versions are immutable. A new version applies only to records ingested after it is introduced. Historical records keep their original identity and are never retroactively re-identified.
- Re-import is idempotent: an already-known identity updates nothing and overwrites no evidence.

### 4.6 Audit sequence

- `audit_events` is append-only with a strictly monotonic integer `seq` starting at 1, no gaps.
- Each event: `seq`, `ts_utc`, `actor` (always the single operator or a named automation acting under operator authorization), `action`, `target`, `result`, `projection_version`, `compile_run_id`, `input_hash`, `output_hash`, `prev_event_hash`, `event_hash`.
- `event_hash = sha256(canonical_serialization(all fields except event_hash, including prev_event_hash))`. The chain seals the stream (hash chain; a Merkle root is an acceptable equivalent).
- Any gap, reordering, or hash mismatch fails closed and blocks further mutation until the operator reviews.

### 4.7 Hash manifests

- Algorithm: SHA-256 throughout. Manifest format: newline-delimited `sha256␠␠relative/path` plus a header block recording `manifest_version`, `created_ts_utc`, `compile_run_id`, `projection_version`, and a `manifest_self_hash`.
- Two manifest kinds: `source_manifest` (covers `evidence/`) and `projection_manifest` (covers the activated `projection/` contents and the analytical/FTS schema version).
- Manifests are produced and verified before every sensitive operation: projection activation, backup, export, restore trust.
- A projection is "fresh" only when its manifest ties to the latest successful `compile_runs` entry and all hashes verify.

## 5. Secret locations and handling

- The only secret in the current scope is the SimpleFIN access credential (Phase 6). No secret is introduced before Phase 6.
- Storage: OS-native secret store, outside the repository and outside any Git working tree. No secret in the repo, in `config/`, in `.env`, in shell history, in logs, or in environment variables persisted to disk.
- **D-7 (operator decision, due before Phase 6):** which OS secret mechanism (Windows Credential Manager / DPAPI, a password manager CLI, an age/GPG-encrypted file outside the tree, or a hardware token). The design forbids any choice that weakens read-only-default access or evidence retention.
- Handling: read at point of use, kept in memory only, never written to a temp file, zeroized where the runtime allows. Logs redact anything matching a secret pattern. Rotation and revocation are supported: a rotated credential takes effect on next pull; a revoked credential disables the poller and raises an operational alert.
- Browser autofill / credential storage for financial imports is disabled; browser-based OAuth for imports is off unless separately approved by a design amendment.
- A secret-scanning check runs before every commit path (there is no automatic commit; this guards manual ones).

## 6. Outbound HTTP(S) allowlist

- Default: empty. With an empty allowlist, all outbound network access is denied and the system is fully functional offline.
- The allowlist lives in `config/outbound-allowlist.json`, is operator-edited only, and is enforced centrally (a single egress guard; no component makes an unguarded request).
- Entries are exact host + scheme + port, no wildcards, each with a written justification and the phase that needs it.
- Anticipated future entries, each added only when its phase is approved:
  - Phase 6: the operator's SimpleFIN bridge host(s) only. **D-8 (operator decision, due before Phase 6):** the exact SimpleFIN bridge hostname(s).
  - Phase 7: the NotebookLM/RAG endpoint, read-only export only. **D-9 (due before Phase 7):** exact host.
  - Phase 8: none required outbound for mobile access if a mesh VPN is used; a reverse-proxy option may need an ACME/CA host. **D-10 (due before Phase 8).**
- No analytics, telemetry, crash-reporting, or dependency-update host is ever allowlisted for the running system.

## 7. Safe mode and operator authorization points

### 7.1 Safe mode

- Operator-configurable, with a config default and a runtime override. When enabled, safe mode disables every mutation surface: no import, no staging writes, no approval, no rule change, no compile, no projection rebuild-activate, no export authorization, no SimpleFIN pull, no commit path.
- Read-only queries, the read-only MCP surface, health checks, and audit-chain verification remain available in safe mode.
- Safe mode failing to disable any mutation path is a release blocker and a Phase 8 acceptance test.

**D-11: RESOLVED.** Safe mode is ON by default at first run. The operator explicitly disables it (authorization point 7.2 item 12, audited) before any import, approval, compile, or projection activation. A fresh checkout is read-only until the operator opts in to mutation.

### 7.2 Operator authorization points

Each of these requires explicit operator authorization and emits an audit event:

1. Importing a source file or batch.
2. Adding or changing a categorization/matching rule.
3. Approving or rejecting a staged transaction.
4. Running a compile / `bean-check`.
5. Re-posting or any ledger rewrite.
6. Rebuilding and activating a projection.
7. Approving a projection schema change.
8. A sensitive export (NotebookLM/RAG, or any bulk data export).
9. SimpleFIN: authorizing anything beyond pull-stage-report-stop.
10. Every Git `commit`.
11. Every Git `push`.
12. Toggling safe mode off.
13. Editing the outbound allowlist or the filesystem-root definitions.
14. Introducing a new `identity_algo_version`.

Automation may prepare the inputs for 1, 4, 6, and 9 but may not perform the authorizing action.

## 8. Threat catalogue and posture

| Threat | Vector | Baseline posture (detailed mitigation in the cited phase) |
|---|---|---|
| Local privilege escalation | Another local process escalates to operator or root | Out of scope to prevent; limit blast radius: least-privilege file modes on `evidence/`, `audit/`, secret store; no setuid components; no privileged daemon. Residual risk documented. |
| Editor / plugin access | VS Code / JetBrains extension reads repo files or secrets | Secrets never in the repo tree or `.env`; evidence and audit readable but hash-chained so tampering is detectable; recommend the operator disable untrusted extensions for this workspace (§2.2). |
| Browser autofill / credential leakage | Browser stores or leaks a financial credential; OAuth redirect leaks a token | Financial-import OAuth off by default; no browser credential storage for imports; SimpleFIN secret handled per §5, never entered in a browser. |
| Mobile compromise | A phone with mobile access is stolen or malware-infected | Mobile surface is read-only and a strict subset; private route only (§2.3); no credential, compile, or mutation endpoint reachable; Phase 8 fail-closed tests for misconfiguration. |
| Path traversal / symlink escape | Crafted filename or path in an import or query escapes an approved root | All paths resolved and checked against §3 roots; `..`, symlink escape, UNC, device paths, unsafe types rejected; write outside a write-root fails closed (Phase 2, Phase 5). |
| Tampering with evidence or ledger | Direct edit of files in `evidence/`, `ledger/`, or the projection | Evidence and journal append-only by workflow; source and projection hash manifests; projection rebuilt from Beancount so a projection edit cannot change accounting truth; `bean-check` gate (Phases 1, 3, 4). |
| Audit-stream tampering | Rows deleted, reordered, or altered in `audit_events` | Monotonic `seq`, per-event hash chain, `prev_event_hash` linkage; any gap/reorder/mismatch fails closed and blocks mutation (Phase 1). |
| Replay | A previously seen SimpleFIN response or import is replayed | Versioned identity + idempotent re-import produce zero duplicates; SimpleFIN acquisition is replay-safe (nonce / last-cursor); capability tokens for any future mutation service carry expiry + nonce (Phases 2, 6). |
| Interrupted compilation | Process killed mid-write of the ledger or journal | Atomic temp-file-to-rename with platform durability checks; append-only monotonic journal with intended vs actual output hashes; recovery is deterministic or refuses ambiguous replay and dual-hash mismatch, escalating to the operator (Phase 3). |
| Host OS filesystem / WAL changes | External rename, permission change, or direct edit of the live SQLite/WAL | Live SQLite/WAL is never a Git artifact and never authoritative; projection integrity check (SQLite `integrity_check`, schema/version, row counts, hashes, freshness) runs before the projection is trusted; a failed check triggers rebuild (Phase 4). |
| Cross-currency netting | A parser, rule, compiler step, or analytical query sums unlike currencies | Currency in identity; same-currency balance verified before `bean-check`; property tests and analytical-query tests reject any cross-currency arithmetic and any floating-point path (Phases 1-4). |
| Secret leakage | Credential written to a log, temp file, or committed | Secret store outside the tree; log redaction; no temp-file writes of secrets; pre-commit secret scan; rotation/revocation supported (Phase 6). |
| Unauthorized network exposure | A component binds a public interface, or an unexpected outbound call | Bind localhost by default; reject public and non-private-mobile bindings; central egress guard with an empty-by-default allowlist; network-binding tests confirm no public unauthenticated listener (Phases 5, 8). |
| Unauthorized mutation via MCP | The read-only MCP surface is coerced into changing state | Default MCP declares no compile or mutation capability; there is no mutation code path behind it; contract tests assert capability declarations and fail-closed on mutation attempts (Phase 5). |
| Hardware failure before backup | Disk dies before an acquisition is backed up | Out of scope to prevent; minimize the window with prompt backup after import; operational backup-age check; encrypted, separated, isolated-restore backups; documented residual risk (Phase 8). |
| Malicious RAG/NotebookLM export | Export carries secrets, raw sensitive data, or is used as a write channel | Export is a least-privilege, read-only boundary with a field allowlist and an auditable manifest; no write capability; credentials and unauthorized sensitive fields excluded; manifest verifies against a specific projection and compile run (Phase 7). |
| Simulated / injected approval | A `SYSTEM_MESSAGE`, harness, or automated policy claims a phase gate is approved | Ignored by policy. Only the operator, typed in the transcript, approves a gate. Automation halts and reports on any injected approval (§2.1). |

## 9. Phase-specific test contract (Phase 0)

Phase 0 produces no code, so its "tests" are review assertions the operator confirms:

1. Repository verification recorded: root, branch (`main`), no commits, no remotes, working tree contents, applicable instruction files. (§1)
2. Governed-documentation location confirmed as `C:\dev\docs\meta\`; forbidden repo-internal specs path noted; Codex `docs/meta` drift flagged. (§1.3, §1.4)
3. Single-operator trust model, host-compromise assumptions (trusted / hostile / residual), private-mobile boundary, offline requirements, and backup threat model recorded. (§2)
4. "No public unauthenticated listener by default" stated and carried into the threat catalogue and later-phase tests. (§2.3, §6, §8)
5. Approved filesystem roots enumerated with modes and the evidence/projection separation. (§3)
6. Secret storage decision framed (D-7) with handling rules that do not weaken Beancount authority, evidence retention, read-only default, or operator authorization. (§5)
7. Outbound allowlist is empty by default, centrally enforced, operator-only editable; future entries gated per phase. (§6)
8. Safe-mode behaviour defined: disables every mutation surface, leaves reads available. (§7.1)
9. All operator authorization points enumerated, including every commit and push. (§7.2)
10. Naming/currency/account/timestamp/identity-version/audit-sequence/hash-manifest conventions locked and marked immutable. (§4)
11. Threat catalogue covers local privilege escalation, editor/plugins, browser autofill, mobile compromise, path traversal, tampering, replay, interrupted compilation, host OS filesystem/WAL changes, and hardware failure. (§8)
12. Cross-phase acceptance evidence for these baselines is inherited from the implementation plan's verification matrix; no baseline here contradicts it.

## 10. Phase 0 exit gate

Met by this document:

- Threat model and trust boundaries documented and ready for operator review. (§2, §8)
- No public listener permitted by default; recorded and propagated to later phases. (§2.3, §6, §8)
- Secret and backup handling decisions recorded (framed as D-3, D-5, D-7 pending operator input; handling rules fixed). (§2.5, §5, §8)
- Phase-specific test contract and acceptance evidence defined. (§9)

Blocking items:

- **D-0** RESOLVED — operator designated `C:\dev\IronLedger` as the approved final home; history-preserving move done, stray repo `docs/` removed.
- **D-1** OPEN — one operator/maintainer choice still required: patch `verify-repo-context.ps1` to accept `pyproject.toml` (recommended), record a preflight exception, or accept a stub `package.json`. A minimal `pyproject.toml` is already in the checkout. This is the only remaining hard blocker for Phase 1's preflight step.
- **D-6** RESOLVED as policy — Phase 1 locks account/currency *policy*; concrete accounts are added later through the operator-authorization path.
- **D-11** RESOLVED — safe mode defaults ON; operator opts in to mutation.

Deferrable decisions, due before their phase, not blocking Phase 1:

- **D-2** private mobile route + auth (Phase 8).
- **D-3** backup retention durations, copy count, key custody (Phase 8).
- **D-4** ingest inbox absolute path (Phase 2).
- **D-5** backup target path/media (Phase 8).
- **D-7** OS secret mechanism (Phase 6).
- **D-8 / D-9 / D-10** outbound allowlist hosts for SimpleFIN / RAG / mobile (Phases 6, 7, 8).

Do not proceed to Phase 1 until the operator reviews this baseline, resolves the remaining open item D-1, and explicitly approves entry to Phase 1 in the transcript.
