# Wiki Governance Sync - Usage Guide

## Quickstart

```typescript
import handler from '../src/index.js';

// Audit vault without modifications
const auditResult = await handler({
  action: 'audit',
  vaultRoot: 'kb-sync/obsidian/vault/wiki',
  dryRun: true
});

console.log(`Found ${auditResult.findingsCount} schema findings across ${auditResult.syncedRepos.length} repos.`);
```

## Actions

### `audit`
Performs read-only scanning across all wiki pages for naming conventions, schema structure, tag formatting, and broken/empty wikilinks.

### `sync`
Synchronizes knowledge base references and applies auto-remediations when enabled.

### `archive`
Archives obsolete sync artifacts or historical runs beyond the retention window.
