# hook-validator — Integration

```
.git/hooks/pre-commit (file on disk)
        |
        v
  hook-validator (src/index.js)
        |
        +--> Check 1: Shim Completeness
        |      does the shim contain governance-check, secret-scan,
        |      retro-schema-check, roadmap-validator?
        |
        +--> Check 2: Order-Independence
        |      does the shim carry the "merged-shim" marker written
        |      by the reconciling installer?
        |
        +--> Check 3: Sequencing
        |      do the hooks appear in the expected order?
        |
        v
  verdict: GREEN | YELLOW | RED  -->  stdout (human) or JSON (--verbose)
                                  -->  process exit code (0/1/2)
```

Consumers: run manually (`node src/index.js`) or wire into CI / a
meta pre-commit step to catch a broken hook chain before it lands.
No network calls, no writes — read-only against `.git/hooks/pre-commit`.
