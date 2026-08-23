# retro-schema-validator — Integration

```
.retro/*.json (or a single file path)
        |
        v
  retro-schema-validator (src/index.js)
        |
        v
  validateNode(data, SCHEMA)  -- recursive, walks:
        date, type            (string)
        metrics.unit_scale    (number, 0-100)
        metrics.active_days   (number, 0-7)
        metrics.commits_authored, metrics.issues_closed  (number)
        sections.wins/blockers/next  (array)
        notes                 (string)
        + flags any key not in SCHEMA as an unknown-field warning
        |
        v
  verdict: GREEN | YELLOW | RED  -->  stdout (human) or JSON (--verbose)
                                  -->  process exit code (0/1/2)
```

Intended use: gate on `.retro/*.json` before it's committed
(`node src/index.js --all`), so a schema regression like the
2026-07-12 unit_scale/active_days bug is caught at write time,
not discovered retroactively.
