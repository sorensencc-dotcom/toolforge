# Open TRM act PR

Take a ticket to an opened pull request with the repo's branch, commit, and PR conventions.

## Quick start

Say "trm act #215" or "fix issue #215 and open a PR".

## What it does

- Names the branch `trm/act-<slug>` and the commit `type(scope): summary (closes #N)`.
- Runs tests under a 60-second timeout before committing.
- Builds a PR body with Why, Scope, Tradeoffs, Blast Radius, and Tests, then binds the PR in the app.

---

**For Setup, Requirements, Inputs/Outputs, Error Codes, Testing:** See [Skill Operator Guide](../../docs/meta/skill-operator-guide.md).
