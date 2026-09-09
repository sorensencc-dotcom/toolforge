# Unified Multi-Client MCP Governance Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a centralized MCP registry and deterministic multi-client profile compiler that enforces token budgets via `js-tiktoken`, eliminates process sprawl, and safely updates Codex, Claude Code, Grok, Claude Desktop, Antigravity, and local models.

**Architecture:** A canonical TOML registry (`.sigil/mcp-registry.toml`) serves as the single source of truth. A modular Node.js engine (`scripts/mcp-governance/`) parses profiles, validates exact serialized schema token budgets against `js-tiktoken`, and applies non-destructive AST-safe block replacements with atomic file swaps (`.tmp` -> `.bak` -> rename) across all client configurations.

**Tech Stack:** Node.js 24+ (`node:test`, `node:fs`, `node:path`), `@iarna/toml` / regex AST parser, `js-tiktoken`, PowerShell 7 (Janitor integration).

## Global Constraints

- Never wipe comments, formatting, or non-MCP settings from target client config files.
- Always create a `.bak` backup before modifying any config file and use atomic rename.
- Every profile must satisfy both `count(servers) <= max_tools` and `sum(tokens) <= max_schema_tokens`.
- All tests must run with `node --test` under a strict timeout.

---

### Task 1: Canonical MCP Registry Definition

**Files:**
- Create: `C:/dev/.sigil/mcp-registry.toml`

**Interfaces:**
- Produces: Complete TOML registry defining `[profiles.*]` and `[servers.*]`.

- [ ] **Step 1: Write the canonical registry file**

```toml
# Canonical Multi-Client MCP Registry
version = 1

[profiles.minimal]
description = "For Ollama and small-context local models (8k-32k window)"
max_tools = 4
max_schema_tokens = 2500
servers = ["kb-context-cache"]

[profiles.dev-minimal]
description = "Lightweight CLI profile with memory and core context only"
max_tools = 6
max_schema_tokens = 5000
servers = ["kb-context-cache", "ijfw-memory"]

[profiles.dev]
description = "Standard developer profile for Codex CLI and Claude Code"
max_tools = 12
max_schema_tokens = 12000
servers = ["kb-context-cache", "ijfw-memory", "sigil"]

[profiles.research]
description = "Research and documentation focus with search and knowledge tools"
max_tools = 15
max_schema_tokens = 20000
servers = ["kb-context-cache", "ijfw-memory", "notion", "parallel-search"]

[profiles.full]
description = "Unconstrained profile for Antigravity IDE and Claude Desktop"
max_tools = 50
max_schema_tokens = 45000
servers = ["kb-context-cache", "ijfw-memory", "github", "notion", "chrome-devtools", "sigil"]

# --- Servers ---

[servers.kb-context-cache]
transport = "stdio"
command = "node"
args = ["C:/dev/kb-sync/scripts/mcp-context-server.mjs"]
schema_weight = 600
tags = ["knowledge", "memory", "core"]

[servers.ijfw-memory]
transport = "stdio"
command = "node"
args = ["C:/Users/soren/.ijfw/mcp-server/src/server.js"]
schema_weight = 1200
tags = ["memory", "governance"]

[servers.sigil]
transport = "stdio"
command = "node"
args = ["C:/dev/sigil-repo/sigil/connectors/v1/mcp-stdio-server.mjs"]
schema_weight = 1500
tags = ["sigil", "relay"]

[servers.github]
transport = "sse"
url = "http://127.0.0.1:4411/mcp/github"
schema_weight = 7500
tags = ["git", "api", "heavy"]

[servers.notion]
transport = "sse"
url = "http://127.0.0.1:4411/mcp/notion"
schema_weight = 4000
tags = ["docs", "api", "heavy"]

[servers.parallel-search]
transport = "sse"
url = "https://search.parallel.ai/mcp"
schema_weight = 3500
tags = ["search", "web"]

[servers.chrome-devtools]
transport = "stdio"
command = "node"
args = ["C:/Users/soren/AppData/Local/npm-cache/_npx/15c61037b1978c83/node_modules/chrome-devtools-mcp/dist/index.js"]
schema_weight = 4500
tags = ["browser", "qa"]
```

- [ ] **Step 2: Validate file existence and syntax**

Run: `pwsh -NoProfile -Command "Test-Path C:\dev\.sigil\mcp-registry.toml"`  
Expected: `True`

- [ ] **Step 3: Commit**

```bash
git add .sigil/mcp-registry.toml
git commit -m "feat(mcp): add canonical mcp-registry.toml"
```

---

### Task 2: Registry Parser & Exact Budget Validator

**Files:**
- Create: `C:/dev/scripts/mcp-governance/registry.mjs`
- Test: `C:/dev/scripts/mcp-governance/test/registry.test.mjs`

**Interfaces:**
- Produces:
  - `loadRegistry(filePath): { profiles, servers, version }`
  - `validateBudgets(registry, customTokenCounts?): { valid: boolean, errors: string[], profileStats: Record<string, any> }`

- [ ] **Step 1: Write the failing test**

```javascript
import test from 'node:test';
import assert from 'node:assert/strict';
import { loadRegistry, validateBudgets } from '../registry.mjs';

test('loadRegistry parses profiles and servers correctly', () => {
  const reg = loadRegistry('C:/dev/.sigil/mcp-registry.toml');
  assert.ok(reg.profiles.dev);
  assert.ok(reg.servers['kb-context-cache']);
  assert.equal(reg.profiles.dev.servers.includes('sigil'), true);
});

test('validateBudgets succeeds on valid profile budgets', () => {
  const reg = loadRegistry('C:/dev/.sigil/mcp-registry.toml');
  const result = validateBudgets(reg);
  assert.equal(result.valid, true);
  assert.equal(result.errors.length, 0);
});

test('validateBudgets flags tool count and token overruns', () => {
  const invalidReg = {
    profiles: {
      overflow: {
        max_tools: 1,
        max_schema_tokens: 500,
        servers: ['s1', 's2']
      }
    },
    servers: {
      s1: { schema_weight: 400 },
      s2: { schema_weight: 300 }
    }
  };
  const result = validateBudgets(invalidReg);
  assert.equal(result.valid, false);
  assert.ok(result.errors.some(e => e.includes('max_tools')));
  assert.ok(result.errors.some(e => e.includes('max_schema_tokens')));
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test C:/dev/scripts/mcp-governance/test/registry.test.mjs`  
Expected: FAIL (Cannot find module)

- [ ] **Step 3: Write minimal implementation in `registry.mjs`**

Implement `loadRegistry` and `validateBudgets` supporting TOML parsing and budget validation.

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test C:/dev/scripts/mcp-governance/test/registry.test.mjs`  
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add scripts/mcp-governance/registry.mjs scripts/mcp-governance/test/registry.test.mjs
git commit -m "feat(mcp): implement registry parser and budget validator"
```

---

### Task 3: AST/CST Surgical Config Compilers

**Files:**
- Create: `C:/dev/scripts/mcp-governance/compilers.mjs`
- Test: `C:/dev/scripts/mcp-governance/test/compilers.test.mjs`

**Interfaces:**
- Produces:
  - `compileCodexToml(existingContent, activeServers): string`
  - `compileClaudeJson(existingContent, activeServers): string`
  - `compileDesktopJson(existingContent, activeServers): string`
  - `atomicWriteWithBackup(filePath, newContent): { success: boolean, backupPath: string }`

- [ ] **Step 1: Write the failing test**

```javascript
import test from 'node:test';
import assert from 'node:assert/strict';
import { compileCodexToml, compileClaudeJson, compileDesktopJson, atomicWriteWithBackup } from '../compilers.mjs';

test('compileCodexToml replaces only [mcp_servers] block and preserves comments/settings', () => {
  const input = `# User settings\nmodel = "gpt-5"\n\n[mcp_servers.old]\ncommand = "node"\n\n[plugins."test"]\nenabled = true\n`;
  const servers = {
    'kb-cache': { transport: 'stdio', command: 'node', args: ['C:/test.js'] }
  };
  const output = compileCodexToml(input, servers);
  assert.ok(output.includes('# User settings'));
  assert.ok(output.includes('model = "gpt-5"'));
  assert.ok(output.includes('[plugins."test"]'));
  assert.ok(output.includes('[mcp_servers.kb-cache]'));
  assert.equal(output.includes('old'), false);
});

test('compileClaudeJson replaces mcpServers object and preserves other keys', () => {
  const input = JSON.stringify({ theme: "dark", mcpServers: { old: {} } }, null, 2);
  const servers = {
    'ijfw': { transport: 'stdio', command: 'node', args: ['server.js'] }
  };
  const output = compileClaudeJson(input, servers);
  const parsed = JSON.parse(output);
  assert.equal(parsed.theme, "dark");
  assert.ok(parsed.mcpServers.ijfw);
  assert.equal(parsed.mcpServers.old, undefined);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test C:/dev/scripts/mcp-governance/test/compilers.test.mjs`  
Expected: FAIL

- [ ] **Step 3: Write minimal implementation in `compilers.mjs`**

Implement surgical block replacement and atomic write/backup utilities.

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test C:/dev/scripts/mcp-governance/test/compilers.test.mjs`  
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add scripts/mcp-governance/compilers.mjs scripts/mcp-governance/test/compilers.test.mjs
git commit -m "feat(mcp): implement ast-safe client config compilers"
```

---

### Task 4: Unified CLI Controller (`sigil mcp`)

**Files:**
- Create: `C:/dev/scripts/mcp-governance/cli.mjs`
- Modify: `C:/dev/sigil-repo/sigil/cli/sigil.mjs`
- Test: `C:/dev/scripts/mcp-governance/test/cli.test.mjs`

**Interfaces:**
- CLI Commands:
  - `node scripts/mcp-governance/cli.mjs validate`
  - `node scripts/mcp-governance/cli.mjs sync [--dry-run] [--client <name>]`
  - `node scripts/mcp-governance/cli.mjs status`
  - `node scripts/mcp-governance/cli.mjs profile set <client> <profile>`

- [ ] **Step 1: Write the failing test**

```javascript
import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';

test('cli status returns active profiles and budget statistics', () => {
  const out = execFileSync('node', ['C:/dev/scripts/mcp-governance/cli.mjs', 'status'], { encoding: 'utf8' });
  assert.ok(out.includes('MCP Governance Status'));
  assert.ok(out.includes('minimal'));
  assert.ok(out.includes('dev'));
});

test('cli validate exits 0 on valid registry', () => {
  const out = execFileSync('node', ['C:/dev/scripts/mcp-governance/cli.mjs', 'validate'], { encoding: 'utf8' });
  assert.ok(out.includes('PASS'));
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test C:/dev/scripts/mcp-governance/test/cli.test.mjs`  
Expected: FAIL

- [ ] **Step 3: Implement `cli.mjs` command router**

Connect registry, budget validation, and compilers into executable CLI subcommands with `--dry-run` support.

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test C:/dev/scripts/mcp-governance/test/cli.test.mjs`  
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add scripts/mcp-governance/cli.mjs scripts/mcp-governance/test/cli.test.mjs
git commit -m "feat(mcp): implement unified mcp governance cli router"
```

---

### Task 5: End-to-End Verification & Janitor Integration

**Files:**
- Test: `C:/dev/scripts/mcp-governance/test/e2e-sync-and-janitor.test.mjs`

- [ ] **Step 1: Write the end-to-end integration test**

Verify that running `node scripts/mcp-governance/cli.mjs sync` successfully writes the designated profiles to test fixtures and that `powershell -NoProfile -ExecutionPolicy Bypass -File C:/dev/utilities/node-process-janitor.ps1` runs without errors.

- [ ] **Step 2: Execute test suite**

Run: `node --test C:/dev/scripts/mcp-governance/test/e2e-sync-and-janitor.test.mjs`  
Expected: PASS

- [ ] **Step 3: Commit and push**

```bash
git add scripts/mcp-governance/
git commit -m "test(mcp): add e2e sync and process janitor integration test"
git push origin HEAD
```
