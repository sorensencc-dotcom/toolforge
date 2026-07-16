# CAST IRON CHARLIE Governance Directory

Status: `IMPLEMENTED CANDIDATE — NOT OPERATIONAL`

This directory groups CIC governance component artifacts. It does not replace
or outrank repository governance.

## Authority

Authority follows, in descending order:

1. Tier 1 decisions and approvals.
2. `CLAUDE.md` project instructions.
3. `docs/meta/governance/global-operating-rules-cic-rewrite-labs.md`.
4. Ratified phase charters and amendments.
5. Ratified artifacts in this directory.
6. Operational implementations and historical records.

Codex and other automation operate as Tier 3. They may validate, generate,
and record within approved rules. They cannot ratify amendments, resolve
governance conflicts, or grant authority to themselves.

## Directory Contract

| Path | Purpose | Current state |
| --- | --- | --- |
| `MANIFEST/` | Consolidated index and compatibility map | Candidate |
| `SPEC/` | Ratified CIC specifications | Candidate |
| `LINEAGE/` | Append-only operational history | Implemented, empty |
| `WRAPPERS/` | Engine wrappers and wrapper registry | Candidate |
| `SCHEMA/` | Versioned validation schemas | Candidate |
| `PIPELINE/` | Pipeline definitions and diagrams | Candidate |
| `AMENDMENTS/` | Proposed and ratified amendments | Draft registry |
| `README/` | Onboarding material | Defined |

Candidate means component exists and local tests pass, but it is not ratified,
deployed, or operational. Empty lineage means no governed runtime action has
occurred.

## Local Verification

```powershell
python -m unittest discover -s CIC-GOVERNANCE/tests -v
```

Current local result: 45/45 tests pass. See
`MANIFEST/gate-implementation-status.md`. Test success does not ratify or close
activation gates.

## Promotion Gate

Component becomes active only after:

1. Implementation or document exists at declared path.
2. Tests or validation evidence exist where mechanism is claimed.
3. Conformance check passes against current repository patterns.
4. Tier 1 explicitly ratifies governance impact.
5. Manifest status and component registry are updated together.
