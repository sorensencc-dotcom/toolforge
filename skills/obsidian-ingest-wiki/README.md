# obsidian-ingest-wiki

Validates staged Obsidian raw sources and generates Claude Code prompts for 8-phase wiki semantic synthesis.

## Quick Start

```typescript
import { handler } from "./src/index";

// Validate latest staging
const validation = await handler({
  action: "validate",
});

// Generate prompt for specific staging
const prompt = await handler({
  action: "prompt",
  stagingPath: "/vault/_kb-sync-staging/kb-sync/20260711-174821",
});
```

## Actions

- **validate** — Check staging directory integrity (manifest exists, file count > 0)
- **prompt** — Generate Claude Code prompt with resolved paths (includes validation)

## Inputs

- `action` (required): `"validate"` | `"prompt"`
- `stagingPath` (optional): Path to staging directory. Auto-discovers latest if not provided.
- `vaultRoot` (optional): Obsidian vault root. Reads from `configs/obsidian.yaml` if not provided.

## Outputs

### Validation Result

```json
{
  "status": "valid" | "invalid",
  "stagingPath": "/vault/_kb-sync-staging/kb-sync/20260711-174821",
  "manifestFile": "/vault/_kb-sync-staging/kb-sync/20260711-174821/FILES.manifest.txt",
  "fileCount": 43,
  "errors": [],
  "timestamp": "2026-07-11T19:30:00Z"
}
```

### Prompt Result

```json
{
  "status": "success",
  "prompt": "=== OBSIDIAN WIKI INGEST PROMPT ===\n...",
  "stagingPath": "/vault/_kb-sync-staging/kb-sync/20260711-174821",
  "vaultRoot": "/vault",
  "timestamp": "2026-07-11T19:30:00Z"
}
```

## Configuration

Reads from `configs/obsidian.yaml`:

```yaml
vault_root: /path/to/vault
staging_dir: _kb-sync-staging
wiki_dir: wiki
```

## Error Conditions

- `STAGING_NOT_FOUND` — Staging directory doesn't exist
- `MANIFEST_MISSING` — Manifest file not in staging
- `INVALID_ACTION` — Action not "validate" or "prompt"
- `CONFIG_MISSING` — obsidian.yaml not found

## Integration

- **kb-sync**: Wraps `modules/obsidian/ingest-wiki.sh` bash script
- **Toolforge**: Registered as operational skill
- **CIC**: Compatible with CIC workflows

## Docs

See [docs/README.md](docs/README.md) for full usage, workflow, configuration, and examples.

---

**Type**: operational  
**Category**: knowledge-base  
**Runtime**: Node.js (TypeScript)  
**Timeout**: 30s
