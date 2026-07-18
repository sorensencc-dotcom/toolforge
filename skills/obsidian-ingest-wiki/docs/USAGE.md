# obsidian-ingest-wiki — Usage Guide

Validates staged Obsidian raw sources and generates Claude Code prompts for 8-phase wiki semantic synthesis.

## Capabilities

### 1. Validate Staging

Pre-flight check before wiki synthesis. Verifies:
- Staging directory exists
- Manifest file present (`FILES.manifest.txt`)
- File count > 0
- Manifest readable

**Output**: Validation result with status, errors, file count, timestamp.

### 2. Generate Prompt

Generate ready-to-copy Claude Code prompt. Includes:
- Resolved staging path (auto-discovered if needed)
- Resolved vault root
- 8-phase workflow steps
- Schema reference
- Constraints and best practices

**Output**: Markdown-formatted prompt for copy-paste into Claude Code.

## Configuration

Reads `configs/obsidian.yaml`:

```yaml
vault_root: /path/to/vault
staging_dir: _kb-sync-staging
wiki_dir: wiki
```

Can override via input:
```typescript
{ action: "validate", vaultRoot: "/custom/vault" }
```

## Integration Points

### kb-sync

Wraps `modules/obsidian/ingest-wiki.sh` bash script. TypeScript implementation provides:
- Structured input/output
- Programmatic API
- Error handling
- Testing framework

### Toolforge

Registered as operational skill:
- Discoverable via `./run-tool.ps1 -List -Category skills`
- Invocable via handler interface
- Manifest registered at `toolforge/manifest.json`

### Cowork

Compatible with Cowork for agent integration:
- Skills registered on installer run
- Available to agents as callable tool
- Supports `validate` and `prompt` triggers

## Testing

Test suite in `tests/index.test.ts` covers:

1. **Staging Validation**
   - Validates existing staging directory
   - Fails for non-existent directory
   - Fails when manifest missing

2. **Prompt Generation**
   - Generates prompt with correct paths
   - Includes all 8 phases
   - Includes constraints

3. **Error Conditions**
   - Handles missing config
   - Handles missing paths
   - Handles invalid actions

Run:
```bash
npm test
```

## Dependencies

### Internal
- `configs/obsidian.yaml` — Vault configuration
- `kb-sync/modules/obsidian/ingest-wiki.sh` — Bash implementation (reference)

### External
- Node.js 18+
- TypeScript 5.0+
- Built-in: fs, path

## Permissions

**Required**:
- `read:repo` — Access repository files
- `read:config` — Read obsidian.yaml

## Related Documentation

- `docs/targets/obsidian.md` — Three-layer vault specification
- `modules/wiki/operator-workflow.md` — 8-phase detailed workflow
- `modules/wiki/schema.md` — Entity/concept page templates

## Changelog

| Date | Version | Changes |
|------|---------|---------|
| 2026-07-11 | 1.0.0 | Initial implementation: validate + prompt actions |
