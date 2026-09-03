# IronLedger Phase 2b handoff

Written 2026-09-03 at the close of the Phase 2a session. Start Phase 2b in a fresh session using this as the resume point.

## Where Phase 2a left off

Phase 2a exit gate was approved by the operator in the session transcript on 2026-09-03. Evidence and decision are recorded in `docs/meta/phases/ironledger-phase-2a-evidence.md` (status line plus section 11).

Branch state:

| Branch | Head | Contents |
|---|---|---|
| `ironledger/phase-2a-evidence` (pushed to `origin`) | `1dfe6860` | Phase 2a evidence doc, dependency posture, and the three planning docs (spec, `ironledger-phase-2a-plan.md`, `ironledger-phase-2-plan.md`). Not yet merged to `main`. |
| `ironledger/phase-2a-spec` (local + `origin`) | `8309455b` | Stale. Carries the same three planning docs plus about 40 unrelated daemon deletions. Its useful content is now on the evidence branch. Abandon it; do not merge. |
| `main` | `d6596255` (`origin/main`) | No IronLedger code or docs. |

The IronLedger implementation lives in `C:\dev\IronLedger` (separate repo, no remote, local `main` at `fc42545`). Phase 2a Tasks 1 through 14 are implemented there. Focused suite: 155 passed, 1 skipped.

## Open item before or alongside Phase 2b

Merge `ironledger/phase-2a-evidence` to `main` (docs only, no code) so the Phase 2a artifacts land, and close `ironledger/phase-2a-spec` without merging. This was deferred at the operator's request to keep Phase 2a a clean stopping point.

## Phase 2b scope

Phase 2a shipped file acquisition, parsing, canonical versioned identity, idempotent staging, a read-only `review list`, and the operator-authorization gate for `import` and `fitid-trust add`. Phase 2a plan section §13 explicitly deferred the rest of implementation-plan Phase 2 item 5.

Phase 2b is the review and categorization workflow:

1. **Categorization.** Assign the `contra` posting leg's account. Phase 2a imports leave the contra leg's `account` NULL (migration 0003 `contra`-only-null `CHECK`); the two `minor_units` values already sum to zero per currency, so a same-currency balance check passes before categorization. OFX imports currently get a deterministic placeholder account from `_with_placeholder_account`; Phase 2b review reassigns it. See `ironledger-phase-2a-plan.md` lines 554-556, 2500, 2587.
2. **Approve and reject.** Move a `staged_transaction` from `staged` to an approved or rejected state, operator-authorized, safe-mode gated, audited.
3. **Categorization rules.** Optional rule surface for auto-assigning accounts by payee or other row fields, if the Phase 2b spec keeps it in scope (Phase 2a rejected any rule engine).
4. **Interactive review loop.** A guided review command beyond the read-only `review list`.

Compile to Beancount and the analytics projection stay out of Phase 2b; they are implementation-plan Phase 3 and Phase 4.

## First steps for the Phase 2b session

1. Read `docs/meta/specs/ironledger-architecture-design.md`, `docs/meta/specs/ironledger-phase-2a-ingestion-design.md`, and `docs/meta/plans/ironledger-implementation-plan.md` Phase 2 and Phase 3 sections.
2. Run `superpowers:brainstorming` to scope the Phase 2b slice: exact review states, whether rules are in or out, the interactive command surface, the operator-authorization phrase for approve and reject, and the audit events.
3. Write the Phase 2b ingestion or review spec, then run it through plan review before the first plan commit.
4. `superpowers:writing-plans` for the TDD task breakdown, in the same discipline as `ironledger-phase-2a-plan.md`.
5. Get explicit operator approval of the Phase 2b plan in the transcript before any code, per `docs/meta/plans/ironledger-implementation-plan.md` "Approval gates".

## Governance constraints that carry forward

- `C:\dev\IronLedger` is the operator-approved home (decision D-0). No git remote, no push.
- `config/filesystem-roots.json` `ingest_inbox` is unset in the repo (decision D-4); only the example file is committed. Not a code blocker.
- Focused-suite evidence only. Full-suite runs, live bank-file imports, and production evidence stay deferred.
- Each phase requires operator review of exit evidence before the next phase starts.
