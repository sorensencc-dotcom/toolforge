# CIC Tool Surface — Phase 4 Design

Date: 2026-07-17
Status: Approved, implemented (commit pending)

## Context

Phases 1-3 shipped four Toolforge skills plus `cic-orchestrate-flow` (Phase 3,
`docs/meta/specs/cic-tool-surface-phase3-design.md`). Phase 1's doc named
Phase 4 "governance alignment" and scoped it concretely in its own
out-of-scope section: *"Deterministic commit-message templates,
RUN-ID/GATE-ID/PROFILE-ID tagging conventions, and other governance-alignment
items from the full 5-phase plan."*

This spec covers **that narrow slice only**: a standard tag format embedding
RUN-ID/GATE-ID/PROFILE-ID, and a commit-message template that uses it. It
does **not** wire CIC tool runs into `CIC-GOVERNANCE`'s hash-chain/lineage/
amendment machinery (user-selected scope, narrower than "full governance
alignment") and does **not** add automatic git-commit behavior to any skill —
committing stays a human/CI action, unchanged.

## Verified starting state (and one correction to prior docs)

- `RUN-ID`: already exists as `generateRunId()` → `run-<compactIso>-<hex6>`.
  No change needed.
- `GATE-ID`: already exists as free text validated by
  `/^GATE-\d{2}$/` in `cic-run-gate`. No change needed.
- `PROFILE-ID`: **does not exist as a convention.** All four Phase 1 skills
  plus `cic-orchestrate-flow` accept `profile?: string` as free-form,
  optional, unvalidated input. Nothing currently formats it as an ID or
  defaults it when absent.
- **Correction:** Phase 1-3 docs stated "GATE-02/03/05 still open
  (unratified)," sourced from `CIC-GOVERNANCE/MANIFEST/gate-implementation-status.md`
  (dated 2026-07-14). Checked this session:
  `CIC-GOVERNANCE/MANIFEST/gate-registry.json` (doc `CIC-GATE-SPEC-001` v1.0.4-candidate.1,
  `STABLE / SEALED`) shows all five gates `CLOSED`, each with a
  `closure_amendment` and `closure_lineage_id`. `CIC-GOVERNANCE/AMENDMENTS/`
  has non-draft `AMD-v2.4.0-GATE-0{2,3,5}-CLOSED.json` files (alongside
  `.draft.json` versions) and `CIC-GOVERNANCE/confirmation/` has ratification
  confirmations for every gate. `gate-implementation-status.md` is simply
  stale — it predates those closures. This doesn't change Phase 4 scope
  (tagging is gate-count-agnostic) but the stale doc should be refreshed or
  removed separately; flagged here, not fixed as part of this phase (out of
  scope — a `CIC-GOVERNANCE` doc-accuracy fix, not a tool-surface change).

## Decisions

1. **New shared helper, not a new skill.** `_cic-shared/src/governanceTag.ts`
   exports `formatGovernanceTag(parts: { runId: string; gateId?: string;
   profileId?: string }): string`. A formatting utility, not a tool — matches
   how `runId`/`artifactPaths` already live in `_cic-shared`.
2. **PROFILE-ID convention: `input.profile` if given, else literal
   `"default"`.** No slugification/validation added — free-form profile
   strings are used as-is inside the tag; this phase defines the *tag
   format*, not a profile registry.
3. **Tag format:** `[RUN-ID:<runId>][GATE-ID:<gateId>][PROFILE-ID:<profileId>]`.
   `GATE-ID` segment is omitted entirely when no `gateId` is available
   (`cic-ingest-world`, `cic-repair-pipeline`, `cic-consolidate-artifacts`
   have no gate concept) — no `GATE-ID:n/a` placeholder invented.
4. **Every skill's output gains one additive field: `governanceTag: string`.**
   `cic-ingest-world`, `cic-repair-pipeline`: `[RUN-ID:...][PROFILE-ID:...]`
   (no gate). `cic-run-gate`: `[RUN-ID:...][GATE-ID:...][PROFILE-ID:...]`.
   `cic-consolidate-artifacts`: uses `bundleId` in the `RUN-ID` slot (already
   the run-id-shaped identifier for that tool) —
   `[RUN-ID:<bundleId>][PROFILE-ID:...]`. `cic-orchestrate-flow`: uses
   `flowId` in the `RUN-ID` slot, includes `GATE-ID` (it always has one —
   defaults to `GATE-01`). Existing output shapes are unchanged otherwise —
   purely additive field, same pattern Phase 2 used for lineage/report
   writes.
5. **Commit-message template is a doc, not code.** New file
   `CIC-GOVERNANCE/templates/commit-message-template.md` defines the trailer
   format for commits that record a CIC tool run:

   ```text
   <type>(cic): <summary>

   <body — optional>

   RUN-ID: <runId>
   GATE-ID: <gateId, omit line if none>
   PROFILE-ID: <profileId>
   ```

   No skill reads or writes git commits. A human (or a future, separately
   spec'd CI step) copies the relevant IDs from a tool's `governanceTag` /
   output fields into this trailer by hand. This keeps commit creation a
   manual/Tier-1-visible action per `CLAUDE.md`'s guardrail against automatic
   approval/execution, while still giving it a deterministic shape.

## `_cic-shared` addition

```ts
// governanceTag.ts
export function formatGovernanceTag(parts: { runId: string; gateId?: string; profileId?: string }): string {
  const profileId = parts.profileId ?? 'default';
  const segments = [`RUN-ID:${parts.runId}`];
  if (parts.gateId) segments.push(`GATE-ID:${parts.gateId}`);
  segments.push(`PROFILE-ID:${profileId}`);
  return `[${segments.join('][')}]`;
}
```

## Per-skill changes

All five skills: after building their existing result object, add

```ts
governanceTag: formatGovernanceTag({ runId, gateId, profileId: input.profile }),
```

(substituting `bundleId`/`flowId` for `runId` and omitting `gateId` where
noted in Decision 4). Field is additive to each `Output` interface; no
existing field renamed or removed.

## Testing

- `_cic-shared/tests/shared.test.ts`: add `describe('formatGovernanceTag')` —
  with gateId, without gateId, default profileId when omitted, custom
  profileId passed through.
- Each of the 5 skills' existing `tests/skill.test.ts`: add one assertion
  that `result.governanceTag` matches the expected bracket pattern (regex,
  not exact string, since `runId`/`flowId`/`bundleId` are generated).
- No new test files; extend existing suites only (5 skills + shared).

## Explicitly out of scope (Phase 4)

- Wiring CIC tool runs into `CIC-GOVERNANCE` hash-chain/lineage/amendment
  machinery (the "full governance alignment" option user declined this
  round).
- Any automatic git commit, hook, or CI step that writes commits using the
  template — template is reference documentation only.
- `PROFILE-ID` validation/registry/slugification.
- Fixing the stale `gate-implementation-status.md` (flagged above, separate
  task).
- GATE-02/03/05 *support in `cic-run-gate`'s adapter* — that's an actual
  `GATE_HANDLERS` extension (Phase 1 design's stated extension point), a
  different, larger change than this phase's tagging scope, even though the
  gates themselves are now confirmed closed.
- Grok Build wiring, TorqueQuery integration (still their own future phases).
