---
title: "CIC Commit-Message Template"
document_id: "CIC-GOV-COMMIT-MESSAGE-TEMPLATE"
category: "template"
status: "active"
version: "1.0.0"
---

# CIC Commit-Message Template

Reference documentation only — no skill or hook writes commits automatically.
When a commit records the result of a CIC tool run (`cic-ingest-world`,
`cic-run-gate`, `cic-repair-pipeline`, `cic-consolidate-artifacts`,
`cic-orchestrate-flow`), copy the relevant IDs from that tool's output
(`runId`/`bundleId`/`flowId`, `gateId`, `profile`) into this trailer by hand.

## Template

```
<type>(cic): <summary>

<body — optional, explain why>

RUN-ID: <runId, or bundleId/flowId for consolidate/orchestrate>
GATE-ID: <gateId — omit this line entirely if the run has no gate>
PROFILE-ID: <profile, or "default" if none was passed>
```

## Example

```
fix(cic): repair GATE-01 artifact-store lock timeout

Investigated via cic-run-gate FAIL, repaired via cic-repair-pipeline.

RUN-ID: run-20260717T090000Z-a1b2c3
GATE-ID: GATE-01
PROFILE-ID: default
```

## Notes

- `RUN-ID`/`GATE-ID`/`PROFILE-ID` format matches `_cic-shared/src/governanceTag.ts`'s
  `formatGovernanceTag()` bracket output (`[RUN-ID:...][GATE-ID:...][PROFILE-ID:...]`)
  — this template just lays the same three values out as commit trailers
  instead of inline brackets.
- Omitting `GATE-ID` for tools with no gate concept (`cic-ingest-world`,
  `cic-repair-pipeline`, `cic-consolidate-artifacts` when not run via
  `cic-orchestrate-flow`) is correct — don't invent a placeholder value.
- This is a Phase 4 (CIC Tool Surface) deliverable — see
  `docs/meta/specs/cic-tool-surface-phase4-design.md`.
