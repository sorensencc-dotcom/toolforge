# db-migrate Usage Guide

## Quick Start

```bash
# Generate a new migration
claude /db-migrate generate "add user roles table"

# This creates: src/db/migrations/20260718_001_add_user_roles_table.sql
```

## Commands

### generate `<description>`
Creates a new timestamped migration file with transaction template.

```bash
claude /db-migrate generate "add email index to users"
# Creates: src/db/migrations/20260718_002_add_email_index_to_users.sql
```

**Output file includes:**
- Timestamp + sequence number (ensures order)
- Transaction wrapper (BEGIN/COMMIT)
- Comment template for UP/DOWN operations

### validate
Checks all migrations for syntax issues and risky patterns.

```bash
claude /db-migrate validate
# Output:
# ✅ Validated 12 migrations
# (or lists specific warnings/errors)
```

**Checks for:**
- Missing BEGIN/COMMIT transactions
- Risky patterns (DROP COLUMN, TYPE changes, NOT NULL without DEFAULT, etc.)

### review `<file>`
Deep review of a single migration file.

```bash
claude /db-migrate review src/db/migrations/20260718_001_add_users.sql
# Flags risky patterns with explanations
```

### status
Shows migration status summary.

```bash
claude /db-migrate status
# Run `npm run migrate` to see applied vs pending
```

## Common Workflows

### Before Deployment
```bash
# 1. Generate migration
claude /db-migrate generate "rename users table to accounts"

# 2. Review it (edit manually, then)
claude /db-migrate review src/db/migrations/20260718_003_rename_users_table.sql

# 3. Validate all
claude /db-migrate validate

# 4. Apply
npm run migrate
```

### Risky Changes
If you need a breaking change (e.g., DROP COLUMN), the skill flags it. Proceed only if:
- You have backups
- It's on a branch/dev environment
- All dependent queries are updated

### Rollback
To create a reverse migration:
1. Review original migration
2. Create new migration with inverse operations
3. Test on dev first

## Safety Patterns

✅ **Recommended:**
- Add columns with DEFAULT values
- Create indexes with CONCURRENTLY
- Use transactions for atomicity
- Add constraints in separate migrations

❌ **Avoid:**
- Dropping columns (comment them instead)
- Type changes on populated columns
- NOT NULL without DEFAULT
- Blocking index creation

## Integration with npm

```bash
# Apply migrations
npm run migrate

# Reset (dev only)
npm run migrate:reset
```
