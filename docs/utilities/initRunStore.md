# initRunStore

**Category**: utilities  
**Version**: current  
**Status**: active  
**Owner**: soren  

## Purpose

Create or migrate the Toolforge telemetry SQLite store (`run-store.db`). Idempotent and non-destructive: applies `schema.sql` with `CREATE ... IF NOT EXISTS`, enables WAL, and verifies expected tables.

## Tags

sqlite, telemetry, setup

## Inputs

| Param | Default | Meaning |
|-------|---------|---------|
| `-DbPath` | `C:\dev\run-store.db` | SQLite database file |
| `-SchemaPath` | `C:\dev\schema.sql` | Canonical DDL |

## Outputs

- Database file at `-DbPath` (created or migrated)
- If DB already existed: timestamped backup `run-store-backup-yyyyMMdd-HHmmss.db` beside it
- Console: backup notice, schema applied, table list, `journal_mode`, ready message
- Exit `0` on success; `1` on missing module/schema, init failure, missing tables, or non-WAL mode

## Behavior

1. Require `PSSQLite` module (`Install-Module PSSQLite -Scope CurrentUser -Force` if missing).
2. Require schema file.
3. Backup existing DB before touching it.
4. Set PRAGMAs: `journal_mode=WAL`, `foreign_keys=ON`, `busy_timeout=5000`, `synchronous=NORMAL`.
5. Execute full schema SQL.
6. Verify tables include `alerts`, `errors`, `runs`, `tools`.
7. Confirm journal mode is `wal`.

## Dependencies

- PowerShell
- PSSQLite module
- `C:\dev\schema.sql` (or override)

## Entrypoint

- **File**: `C:\dev\utilities\init-run-store.ps1`

## Examples

```powershell
& "C:\dev\utilities\init-run-store.ps1"
& "C:\dev\utilities\init-run-store.ps1" -DbPath "C:\dev\run-store.db"
```

## Notes

- Safe to re-run; never drops data by design.
- WAL is required - script exits 1 if journal mode is anything else after init.

## See Also

- `C:\dev\schema.sql`
- `C:\dev\run-store.db`
