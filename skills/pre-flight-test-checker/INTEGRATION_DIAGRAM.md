# pre-flight-test-checker — Integration

```
repoRoot (default: cwd)
        |
        v
  pre-flight-test-checker (src/index.js)
        |
        +--> checkEslintConfig(repoRoot)
        |      .eslintignore exists and covers dist/, build/, node_modules/
        |
        +--> checkExternalFixtures(repoRoot, knownFixtures)
        |      required fixtures present (error if missing);
        |      optional fixtures missing -> warning, not a blocker
        |
        +--> checkPlatformCompliance(repoRoot)
        |      scans tests/ for unix-only assumptions
        |      (hardcoded /tmp, /home, inverted platform checks)
        |
        v
  verdict: GREEN | YELLOW | RED  -->  stdout (human) or JSON (--verbose)
                                  -->  process exit code (0/1/2)
```

Intended use: run before `npm test` (`node src/index.js && npm test`)
so environment gaps surface before the suite burns time on failures
that have nothing to do with the code under test.
