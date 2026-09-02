# db-migrate — PostgreSQL Migration Helper

Generate, review, validate, and manage PostgreSQL migrations with confidence.

## Commands

```bash
claude /db-migrate generate "<description>"
# Creates new timestamped migration file in src/db/migrations/

claude /db-migrate validate
# Checks all migrations for syntax errors, missing dependencies

claude /db-migrate status
# Shows applied vs pending migrations

claude /db-migrate review <migration-file>
# Analyzes migration for safety (locks, breaking changes, etc.)

claude /db-migrate rollback-plan <steps>
# Generates reverse migration for rollback scenarios
```

## When to Use

- **Before creating a migration**: Describe what you need; skill generates template
- **Code review**: Paste migration file; skill flags risky patterns
- **Pre-deployment**: Run validate + status to catch issues early
- **Incidents**: Generate rollback plan without manual SQL writing

## Migration Patterns Checked

✅ **Safe patterns:**
- Backward-compatible column additions (with defaults)
- Index creation (concurrent)
- Non-blocking constraints

⚠️ **Risky patterns flagged:**
- Dropping columns (breaks existing queries)
- Changing column types (may lose data)
- Adding NOT NULL without default (blocks existing rows)
- Long-running index creation without CONCURRENTLY

## Example

```bash
# Generate migration
$ claude /db-migrate generate "add user profiles table"

# Review it
$ claude /db-migrate review src/db/migrations/20260718_001_add_user_profiles.sql

# Validate all
$ claude /db-migrate validate
```

## See Also

- `npm run migrate` — Apply pending migrations
- `npm run migrate:reset` — Destructive reset (dev only)
- `docs/schema.md` — Current schema documentation
