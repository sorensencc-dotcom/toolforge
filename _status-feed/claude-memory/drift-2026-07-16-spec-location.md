---
name: drift-2026-07-16-spec-location
description: "Brainstorming skill's generic spec path (docs/superpowers/specs/) used instead of this repo's actual convention (docs/meta/) — caught by user, not self-caught"
metadata: 
  node_type: memory
  type: project
  originSessionId: 42f01400-e2ad-495c-8aab-219a5fbcf7c9
---

Wrote a design spec to `docs/superpowers/specs/YYYY-MM-DD-*.md` (the
superpowers:brainstorming skill's built-in default location) without checking
it against this repo's actual spec convention. c:\dev already has an
established location — `docs/meta/` — holding `global-operating-rules-cic-
rewrite-labs.md`, `TOOLFORGE-MARKETPLACE-SPEC-v1.0.md`, `phase-0-pattern-
research-gate-template.md`, and 25+ other specs/governance docs. Fixed via
`git mv` to `docs/meta/cic-tool-surface-phase1-design.md`, commit `e08af30`.

**Why:** [[workflow-checklists-embedded]]'s Pre-Write Checklist explicitly asks
"Correct location: CLAUDE.md / memory/ / repo / other?" before creating files.
That check was skipped — the brainstorming skill's own default path felt
sufficient and the checklist wasn't consulted, even though CLAUDE.md itself
links to docs/meta/ paths as examples of where governance-class docs live.

**How to apply:** Before writing any new spec/design/governance doc in c:\dev,
check `docs/meta/` first regardless of what a skill's own default path says.
Skill defaults are generic fallbacks, not project convention — a skill
explicitly saying "user preferences override this default" still requires
actively checking, not assuming the default is fine because no one objected
yet. Generalizes beyond specs: any skill-supplied default path should be
checked against existing repo structure before first use in a given project.
