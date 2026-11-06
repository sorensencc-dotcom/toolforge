# Triage skill health warnings: usage

## Examples

- Report lists 18 AuditLog and 4 Manifest warnings: add the 4 manifest entries, tell the user the 18 AuditLog skills need a real run, close only the Manifest row.
- Group cleared but report regenerated with reordered lines: `git checkout` the tracked reports before committing.

## Troubleshooting

- Row not flipped: the tag `<!-- todo-group: toolforge-health-warning:<Group> -->` is missing or the row is already `✅`. `closeTodoRow` returns `changed: false`.
- Fresh report still lists the group: leave the row open and say which skills remain.
- `toolforgeSkillHealthCheck.ps1` may append to its `-TodosPath` backlog; pass a scratch path or revert the file.
