# Dev idea pipeline

Backlog of unbuilt dev ideas — exploration notes, not committed to build.
Distinct from `TODOS.md` (confirmed open work) and `MEMORY.md` (session
history). An idea graduates out of here into a real plan/spec only when
someone decides to build it; until then it sits here as a link plus a
one-line status.

Read this before starting a "should we build X" conversation — check
whether the idea (or something close to it) is already scoped here.

## Open ideas

| Status | Idea | Note doc | Added |
|---|---|---|---|
| exploring | Warp CLI + WhichLLM local-model routing shim | [docs](toolforge-nlm-pack-gate/docs/meta/warp-cli-whichllm-integration-exploration.md) | 2026-09-21 |

## Status values

- `exploring` — write-up exists, no build decision made.
- `scoped` — plan/spec drafted, still not approved to build.
- `building` — approved, active SDD/plan in flight (link the plan, not just this row).
- `parked` — considered, deliberately not pursuing now (note why).
- `shipped` — built; leave the row with a link to the shipped work for history, don't delete.

## Adding an idea

1. Write the exploration note wherever it naturally lives (usually
   `docs/meta/` in the relevant repo).
2. Add one row here linking to it.
3. Add a matching entry to `C:\dev\TODOS.md` so it surfaces in the daily
   status feed / dashboard.
