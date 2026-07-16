# docs/meta Documentation Policy

Canonical naming and placement rules for `docs/meta/`. If this file and `docs/meta/docs-structure-policy-design.md` ever disagree, this file wins — the design doc is historical context, this is the living rule.

## Naming Convention

- kebab-case, all lowercase, `.md` extension
- no numbered prefixes (`1-`, `4-`) — folder groups by type, not by artificial global order
- no SCREAMING_SNAKE_CASE
- version suffix (`-v1.0`, `-v1.5`) kept only when the doc is itself a formally versioned
  spec/governance artifact (its own title/content declares a version) — not kept just
  because the filename happens to have a number in it

## Placement (first match wins — check top to bottom, don't guess from filename alone)

1. `*-REVIEW.md` → `reviews/`
2. superseded/duplicate content (confirmed by diff, not by filename guess) → `archive/`
3. doc is a charter, completion/status report, or state doc, whether or not phase-numbered →
   `phases/`
4. doc is an implementation plan (task breakdown, step sequence for building something) →
   `plans/`
5. doc is a design/integration spec (architecture, contract, schema — not a build task list,
   not a charter) → `specs/`
6. doc is a durable rule/policy/gate that governs how work gets done, not a single
   deliverable's spec → `governance/`
7. none of the above fits → ask, don't force a guess

Charter vs spec vs plan is the recurring ambiguity: charter = "what we're doing and why,
scoped/approved"; spec = "how it's built, technically"; plan = "the ordered task list to
build it." A single phase can have all three as separate files in three different folders —
that's expected, not a bug.

## Every New Subfolder Needs a README.md

One-line purpose + list of contents, matching the pattern in this folder's own `README.md`.

## Dead Docs Move to archive/, Never Deleted

If a doc is superseded, move it to `docs/meta/archive/` with a one-line note in
`archive/README.md` explaining what superseded it and why. Don't delete history.
