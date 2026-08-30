# wiki-sync-recovery — Integration Diagram

**Status: ACTIVE** — `src/diagnose.mjs` is implemented and smoke-tested.

```
npm run wiki:sync  (scripts/sync-github-wiki.mjs)
        |
        | fails; stdout+stderr captured
        v
diagnose.mjs  <--- stdin  |  --log FILE
        |
        | regex match vs MODES[] (4 known failure modes)
        v
runbook entry per match: cause + fix file:line + operator action
        |
        +--> text (default)
        +--> JSON (--json)  --> automation / ci-triage
```

Exit codes: `0` matched, `1` no match, `2` bad input.

Failure modes trace to fix commits `8e7f5603`, `6ecf4cfe`, `d9f0d4dc`
in `scripts/sync-github-wiki.mjs`.
