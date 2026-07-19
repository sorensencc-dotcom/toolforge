---
name: toolforge-cli
description: CLI entry point for Toolforge Marketplace. Delegates to registry-manager and submission-validator.
compatibility: |
  - Runtime: PowerShell 5.1+
  - Dependencies: toolforge-registry-manager, toolforge-submission-validator
---

# Toolforge CLI

Command-line entry point for Toolforge Marketplace operations (list/install/submit).

## Trigger

```powershell
pwsh src/cli.ps1 -Command <list|install|submit> [options]
```

## Input Schema

```typescript
interface CliInput {
  command: "list" | "install" | "submit";
  id?: string;                // For install
  path?: string;              // For submit
  category?: string;          // Filter for list
  status?: string;            // Filter for list
  format?: "table" | "json";  // Output format
  dryRun?: boolean;
}
```

## Output Schema

```typescript
interface CliOutput {
  status: "success" | "error";
  command: string;
  result: Array<any> | object;
  timestamp: string;
}
```

---

**Full reference:** See [Skill Operator Guide](../../docs/meta/skill-operator-guide.md).
