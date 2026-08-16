---
name: guardrail-scripts-installed-2026-06-19
description: Pre-commit hook + boundary checker installed (2026-06-19)
metadata: 
  node_type: memory
  type: project
  date: 2026-06-19
  originSessionId: 11c118cb-0fe8-4755-9b25-9d4f8cef160d
---

## Guardrail Scripts Deployed

**Date:** 2026-06-19 (post-recovery)

### Installed Components

**1. Pre-commit hook** (`C:\dev\.git\hooks\pre-commit`)
- 4.8KB bash script
- Runs automatically on every `git commit`
- 6 blocking rules:
  - ❌ IDE metadata (.ijfw, .gemini, .vscode-remote)
  - ❌ Shadow workspace artifacts (UUID dirs)
  - ❌ Debug statements (debugger, console.*)
  - ❌ Large binary files (>5MB)
  - ❌ Boundary violations (cross-package imports)
  - ❌ Gemini authorship (blocks [gemini] commits)

**2. Boundary checker** (`C:\dev\scripts\boundary-checker.sh`)
- 2.1KB bash script
- Called by pre-commit
- Enforces package isolation:
  - cic → isolated core
  - cic-ingestion → isolated autonomy
  - projects → isolated UI
  - rewrite-mcp → isolated MCP layer
  - scripts, tools → shared utilities

### How It Works

On every `git commit`:

```
1. Pre-commit hook fires
2. Scans staged files for violations
3. Calls boundary-checker.sh for cross-package checks
4. If ANY violations found: commit BLOCKED
5. User must fix violations before retry
```

### Behavior Examples

**Attempt to commit .ijfw file:**
```
git add .ijfw/config.json
git commit -m "test"
❌ IDE CONTAMINATION: .ijfw/config.json contains '.ijfw' — remove
💥 PRE-COMMIT CHECK FAILED
```

**Attempt to import ingestion module in UI:**
```
// projects/cic-operator-console/src/App.tsx
import { MemoryStore } from "cic-ingestion/memory"  // BLOCKED
```

**Commit with console.log:**
```
git add src/index.ts  # contains console.log
❌ DEBUG STATEMENT: src/index.ts contains console.log
💥 PRE-COMMIT CHECK FAILED
```

### Override Mechanism (Emergency Only)

To bypass guardrail (not recommended):
```
git commit --no-verify
```

This disables ALL pre-commit checks. Use only for critical emergency fixes, then file a bug report.

### Testing Hook

```bash
# Create a test violation
echo "console.log('test')" >> test.ts
git add test.ts

# This will be BLOCKED:
git commit -m "test"
# ❌ DEBUG STATEMENT: test.ts contains console.log
```

### Future Enhancements

- Add ESLint integration (auto-fix linting issues)
- Add TypeScript type-check (catch type errors before commit)
- Add test requirement (must pass tests to commit to main)
- Add changelog update requirement (changelog must be updated)

### Integration Points

- `.git/hooks/pre-commit` — hooks dir (executed by git)
- `scripts/boundary-checker.sh` — utilities
- `.env` — not involved (no secrets needed)
- `docker-compose.yml` — not involved
- `package.json` — not involved

### Maintenance

If hook blocks a legitimate commit:
1. Review violation message
2. Fix the issue (remove file, remove debug, etc.)
3. Re-stage: `git add <file>`
4. Retry: `git commit -m "..."`

No config needed. Hook is permanent until deliberately removed.

### Rollback

To remove guardrail (if needed):
```bash
rm C:\dev\.git\hooks\pre-commit
rm C:\dev\scripts\boundary-checker.sh
```

But **don't do this** — the guardrail is your protection.

---

**Related:** [[session-repo-recovery-2026-06-19]]
