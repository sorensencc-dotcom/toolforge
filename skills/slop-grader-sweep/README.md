# slop-grader-sweep

LLM-graded prose quality sweep for this repo's markdown. Wraps
[slop-grader](https://github.com/lukstei/slop-grader)'s `no-ai-slop` and
`tech-docs` rulesets as a warn-only pre-commit check plus a weekly
full-repo report, alongside the deterministic `writing-heuristics` linter.

## Quick start

```bash
cd skills/slop-grader-sweep
npm ci
npm run build
node scripts/install-hook.mjs   # one-time pre-commit hook setup
```

Requires `OPENROUTER_API_KEY` resolvable via the repo's
`credential-resolver.ts` (locally: an environment variable; in CI: the
`OPENROUTER_API_KEY` repo secret).

See `docs/USAGE.md` for workflow details, error-handling behavior, and
troubleshooting. See `SKILL.md` for trigger and I/O schema.
