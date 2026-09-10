import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { spawnSync } from 'node:child_process';
import { EXIT_CODES } from '../registry.mjs';

const REPO_ROOT = path.resolve('C:/dev');
const CLI_PATH = path.resolve(REPO_ROOT, 'scripts/mcp-governance/cli.mjs');
const CANONICAL_REGISTRY = path.resolve(REPO_ROOT, '.sigil/mcp-registry.toml');
const JANITOR_SCRIPT_PATH = fs.existsSync(path.resolve(REPO_ROOT, 'utilities/node-process-janitor.ps1'))
  ? path.resolve(REPO_ROOT, 'utilities/node-process-janitor.ps1')
  : path.resolve(REPO_ROOT, 'dev-sandbox/toolforge-herdr-trm-integration/utilities/node-process-janitor.ps1');

function makeTempDir(prefix = 'mcp-e2e-test-') {
  return fs.mkdtempSync(path.join(os.tmpdir(), prefix));
}

function runPowerShell(args = [], timeoutMs = 8000) {
  const binaries = ['pwsh', 'powershell'];
  for (const bin of binaries) {
    try {
      const res = spawnSync(bin, ['-NoProfile', '-ExecutionPolicy', 'Bypass', ...args], {
        encoding: 'utf8',
        timeout: timeoutMs
      });
      if (res.status !== null) {
        return res;
      }
    } catch {
      // try next binary if available
    }
  }
  throw new Error('Neither pwsh nor powershell could be executed.');
}

// ---------------------------------------------------------------------------
// 1. Full multi-client sync across simulated Codex TOML, Claude JSON,
//    Claude Desktop JSON, Grok bridge, and Antigravity configurations.
// 2. Verified preservation of non-MCP blocks, custom properties, and comments.
// ---------------------------------------------------------------------------
test('e2e: full multi-client sync preserves non-MCP blocks, custom properties, comments, and creates backups', () => {
  const stagingDir = makeTempDir('mcp-e2e-sync-');

  // Set up simulated pre-existing client configs
  const codexDir = path.join(stagingDir, 'codex');
  const claudeDir = path.join(stagingDir, 'claude');
  const desktopDir = path.join(stagingDir, 'desktop');
  const grokDir = path.join(stagingDir, 'grok');
  const antigravityDir = path.join(stagingDir, 'antigravity');

  fs.mkdirSync(codexDir, { recursive: true });
  fs.mkdirSync(claudeDir, { recursive: true });
  fs.mkdirSync(desktopDir, { recursive: true });
  fs.mkdirSync(grokDir, { recursive: true });
  fs.mkdirSync(antigravityDir, { recursive: true });

  const initialCodexToml = [
    '# ===============================================',
    '# User Customized Configuration for Codex CLI',
    '# ===============================================',
    'model = "gpt-5-preview"',
    'temperature = 0.2',
    '',
    '[editor]',
    'tab_size = 4',
    '',
    '[plugins."third-party-analyzer"]',
    'enabled = true',
    'path = "C:/plugins/analyzer.dll"',
    '',
    '[mcp_servers.legacy_outdated_server]',
    'command = "python"',
    'args = ["legacy.py"]',
    '',
    '[experimental]',
    'stream_tokens = true',
    ''
  ].join('\n');

  const initialClaudeJson = JSON.stringify({
    theme: 'matrix-green',
    developerMode: true,
    userPreferences: {
      autoApprove: false,
      editor: 'code',
      fontSize: 14
    },
    mcpServers: {
      legacy_claude_tool: {
        command: 'python',
        args: ['old-tool.py']
      }
    }
  }, null, 2);

  const initialDesktopJson = JSON.stringify({
    preferences: {
      telemetry: false,
      hardwareAcceleration: true
    },
    customExtensions: ['ext-1', 'ext-2'],
    mcpServers: {
      old_desktop_server: {
        command: 'node',
        args: ['desktop-legacy.js']
      }
    }
  }, null, 4);

  const initialGrokJson = JSON.stringify({
    bridgeVersion: '1.0.0',
    grokSettings: {
      listenPort: 9090,
      host: '127.0.0.1'
    },
    mcpServers: {
      stale_grok_server: {
        command: 'node',
        args: ['stale.js']
      }
    }
  }, null, 2);

  const initialAntigravityJson = JSON.stringify({
    ideSettings: {
      inlineCompletions: true,
      bracketColorization: true
    },
    mcpServers: {
      old_antigravity_mcp: {
        command: 'node',
        args: ['old.js']
      }
    }
  }, null, 2);

  const codexPath = path.join(codexDir, 'config.toml');
  const claudePath = path.join(claudeDir, '.claude.json');
  const desktopPath = path.join(desktopDir, 'claude_desktop_config.json');
  const grokPath = path.join(grokDir, 'config.json');
  const antigravityPath = path.join(antigravityDir, 'mcp_config.json');

  fs.writeFileSync(codexPath, initialCodexToml, 'utf8');
  fs.writeFileSync(claudePath, initialClaudeJson, 'utf8');
  fs.writeFileSync(desktopPath, initialDesktopJson, 'utf8');
  fs.writeFileSync(grokPath, initialGrokJson, 'utf8');
  fs.writeFileSync(antigravityPath, initialAntigravityJson, 'utf8');

  // Execute full sync against canonical registry
  const res = spawnSync('node', [
    CLI_PATH,
    'sync',
    `--dest-dir=${stagingDir}`,
    `--registry=${CANONICAL_REGISTRY}`
  ], { encoding: 'utf8' });

  assert.equal(res.status, 0, `Sync failed with exit code ${res.status}: ${res.stderr}\n${res.stdout}`);
  assert.ok(res.stdout.includes('[SYNCED] Codex CLI'), 'Missing Codex sync notice');
  assert.ok(res.stdout.includes('[SYNCED] Claude CLI'), 'Missing Claude sync notice');
  assert.ok(res.stdout.includes('[SYNCED] Claude Desktop'), 'Missing Desktop sync notice');
  assert.ok(res.stdout.includes('[SYNCED] Antigravity'), 'Missing Antigravity sync notice');
  assert.ok(res.stdout.includes('[SYNCED] Grok'), 'Missing Grok sync notice');

  // --- Verify Backups Created with Identical Original Content ---
  assert.ok(fs.existsSync(`${codexPath}.bak`), 'Codex .bak missing');
  assert.equal(fs.readFileSync(`${codexPath}.bak`, 'utf8'), initialCodexToml);

  assert.ok(fs.existsSync(`${claudePath}.bak`), 'Claude .bak missing');
  assert.equal(fs.readFileSync(`${claudePath}.bak`, 'utf8'), initialClaudeJson);

  assert.ok(fs.existsSync(`${desktopPath}.bak`), 'Desktop .bak missing');
  assert.equal(fs.readFileSync(`${desktopPath}.bak`, 'utf8'), initialDesktopJson);

  assert.ok(fs.existsSync(`${grokPath}.bak`), 'Grok .bak missing');
  assert.equal(fs.readFileSync(`${grokPath}.bak`, 'utf8'), initialGrokJson);

  assert.ok(fs.existsSync(`${antigravityPath}.bak`), 'Antigravity .bak missing');
  assert.equal(fs.readFileSync(`${antigravityPath}.bak`, 'utf8'), initialAntigravityJson);

  // --- Verify Codex TOML Preservation & Compilation ---
  const updatedCodex = fs.readFileSync(codexPath, 'utf8');
  assert.ok(updatedCodex.includes('# User Customized Configuration for Codex CLI'), 'Codex header comments lost');
  assert.ok(updatedCodex.includes('model = "gpt-5-preview"'), 'Codex model setting lost');
  assert.ok(updatedCodex.includes('temperature = 0.2'), 'Codex temperature setting lost');
  assert.ok(updatedCodex.includes('[plugins."third-party-analyzer"]'), 'Codex plugins block lost');
  assert.ok(updatedCodex.includes('[experimental]'), 'Codex experimental block lost');
  assert.ok(updatedCodex.includes('stream_tokens = true'), 'Codex stream_tokens lost');
  // Governed servers for default "dev" profile
  assert.ok(updatedCodex.includes('[mcp_servers.kb-context-cache]'), 'Codex missing kb-context-cache');
  assert.ok(updatedCodex.includes('[mcp_servers.ijfw-memory]'), 'Codex missing ijfw-memory');
  assert.ok(updatedCodex.includes('[mcp_servers.sigil]'), 'Codex missing sigil');
  // Legacy server removed
  assert.equal(updatedCodex.includes('legacy_outdated_server'), false, 'Codex retained legacy server');

  // --- Verify Claude CLI JSON Preservation & Compilation ---
  const updatedClaude = JSON.parse(fs.readFileSync(claudePath, 'utf8'));
  assert.equal(updatedClaude.theme, 'matrix-green', 'Claude theme lost');
  assert.equal(updatedClaude.developerMode, true, 'Claude developerMode lost');
  assert.deepEqual(updatedClaude.userPreferences, {
    autoApprove: false,
    editor: 'code',
    fontSize: 14
  }, 'Claude userPreferences corrupted');
  assert.ok(updatedClaude.mcpServers['kb-context-cache'], 'Claude missing kb-context-cache');
  assert.ok(updatedClaude.mcpServers['ijfw-memory'], 'Claude missing ijfw-memory');
  assert.ok(updatedClaude.mcpServers['sigil'], 'Claude missing sigil');
  assert.equal(updatedClaude.mcpServers['legacy_claude_tool'], undefined, 'Claude retained legacy tool');

  // --- Verify Claude Desktop JSON Preservation & Compilation ---
  const updatedDesktop = JSON.parse(fs.readFileSync(desktopPath, 'utf8'));
  assert.deepEqual(updatedDesktop.preferences, {
    telemetry: false,
    hardwareAcceleration: true
  }, 'Desktop preferences corrupted');
  assert.deepEqual(updatedDesktop.customExtensions, ['ext-1', 'ext-2'], 'Desktop extensions corrupted');
  // Full profile servers
  assert.ok(updatedDesktop.mcpServers['kb-context-cache'], 'Desktop missing kb-context-cache');
  assert.ok(updatedDesktop.mcpServers['ijfw-memory'], 'Desktop missing ijfw-memory');
  assert.ok(updatedDesktop.mcpServers['github'], 'Desktop missing github');
  assert.ok(updatedDesktop.mcpServers['notion'], 'Desktop missing notion');
  assert.ok(updatedDesktop.mcpServers['chrome-devtools'], 'Desktop missing chrome-devtools');
  assert.ok(updatedDesktop.mcpServers['sigil'], 'Desktop missing sigil');
  assert.equal(updatedDesktop.mcpServers['old_desktop_server'], undefined, 'Desktop retained old tool');

  // --- Verify Grok Bridge JSON Preservation & Compilation ---
  const updatedGrok = JSON.parse(fs.readFileSync(grokPath, 'utf8'));
  assert.equal(updatedGrok.bridgeVersion, '1.0.0', 'Grok bridgeVersion lost');
  assert.deepEqual(updatedGrok.grokSettings, {
    listenPort: 9090,
    host: '127.0.0.1'
  }, 'Grok settings corrupted');
  // Grok dev-minimal profile servers
  assert.ok(updatedGrok.mcpServers['kb-context-cache'], 'Grok missing kb-context-cache');
  assert.ok(updatedGrok.mcpServers['ijfw-memory'], 'Grok missing ijfw-memory');
  assert.equal(updatedGrok.mcpServers['sigil'], undefined, 'Grok contains sigil unexpectedly in dev-minimal');
  assert.equal(updatedGrok.mcpServers['stale_grok_server'], undefined, 'Grok retained stale server');

  // --- Verify Antigravity JSON Preservation & Compilation ---
  const updatedAntigravity = JSON.parse(fs.readFileSync(antigravityPath, 'utf8'));
  assert.deepEqual(updatedAntigravity.ideSettings, {
    inlineCompletions: true,
    bracketColorization: true
  }, 'Antigravity settings corrupted');
  assert.ok(updatedAntigravity.mcpServers['chrome-devtools'], 'Antigravity missing chrome-devtools');
  assert.equal(updatedAntigravity.mcpServers['old_antigravity_mcp'], undefined, 'Antigravity retained old server');
});

// ---------------------------------------------------------------------------
// 3. Verified --dry-run behavior leaving files completely untouched.
// ---------------------------------------------------------------------------
test('e2e: --dry-run produces preview output while leaving existing and clean directories untouched', () => {
  const emptyDir = makeTempDir('mcp-e2e-dryrun-empty-');

  // 1. Dry run on pristine directory: no files should be created
  const dryResEmpty = spawnSync('node', [
    CLI_PATH,
    'sync',
    '--dry-run',
    `--dest-dir=${emptyDir}`,
    `--registry=${CANONICAL_REGISTRY}`
  ], { encoding: 'utf8' });

  assert.equal(dryResEmpty.status, 0);
  assert.ok(dryResEmpty.stdout.includes('[DRY-RUN] Client: Codex CLI'));
  assert.ok(dryResEmpty.stdout.includes('[DRY-RUN] Client: Claude CLI'));
  assert.ok(dryResEmpty.stdout.includes('[DRY-RUN] Client: Claude Desktop'));
  assert.ok(dryResEmpty.stdout.includes('[DRY-RUN] Client: Antigravity'));
  assert.ok(dryResEmpty.stdout.includes('[DRY-RUN] Client: Grok'));
  assert.ok(dryResEmpty.stdout.includes('--- Compiled Output Preview ---'));

  // Ensure empty directory remained 100% empty
  assert.equal(fs.readdirSync(emptyDir).length, 0, 'Dry run created unexpected files in pristine directory');

  // 2. Dry run on directory with existing files: files must not be modified or get .bak files
  const populatedDir = makeTempDir('mcp-e2e-dryrun-pop-');
  const codexSub = path.join(populatedDir, 'codex');
  fs.mkdirSync(codexSub, { recursive: true });
  const codexFile = path.join(codexSub, 'config.toml');
  const initialContent = '# Untouched sentinel content\nmodel = "sentinel-model"\n';
  fs.writeFileSync(codexFile, initialContent, 'utf8');
  const statBefore = fs.statSync(codexFile);

  const dryResPop = spawnSync('node', [
    CLI_PATH,
    'sync',
    '--dry-run',
    `--dest-dir=${populatedDir}`,
    `--registry=${CANONICAL_REGISTRY}`
  ], { encoding: 'utf8' });

  assert.equal(dryResPop.status, 0);
  assert.equal(fs.readFileSync(codexFile, 'utf8'), initialContent, 'Dry run modified existing file content');
  const statAfter = fs.statSync(codexFile);
  assert.equal(statBefore.mtimeMs, statAfter.mtimeMs, 'Dry run updated file modification time');
  assert.equal(fs.existsSync(`${codexFile}.bak`), false, 'Dry run created unwanted .bak file');
});

// ---------------------------------------------------------------------------
// 4. Verified budget validation blocking over-budget configs unless --force is provided.
// ---------------------------------------------------------------------------
test('e2e: budget validation blocks over-budget sync with exit code 10 unless --force is provided', () => {
  const stagingDir = makeTempDir('mcp-e2e-budget-');
  const badRegistryPath = path.join(stagingDir, 'overbudget-registry.toml');

  // Construct an overbudget registry where the "dev" profile violates both max_tools and max_schema_tokens
  const badRegistryContent = [
    'registry_version = "2026-09-08"',
    'schema_version = 1',
    '',
    '[profiles.dev]',
    'description = "Strict budget violation profile"',
    'max_tools = 1',
    'max_schema_tokens = 500',
    'servers = ["massive-server", "extra-server"]',
    '',
    '[profiles.full]',
    'description = "Unconstrained profile"',
    'max_tools = 10',
    'max_schema_tokens = 50000',
    'servers = ["massive-server"]',
    '',
    '[profiles.dev-minimal]',
    'description = "Minimal profile"',
    'max_tools = 5',
    'max_schema_tokens = 5000',
    'servers = ["extra-server"]',
    '',
    '[servers.massive-server]',
    'transport = "stdio"',
    'command = "node"',
    'args = ["massive.js"]',
    'schema_weight = 4000',
    '',
    '[servers.extra-server]',
    'transport = "stdio"',
    'command = "node"',
    'args = ["extra.js"]',
    'schema_weight = 300'
  ].join('\n');

  fs.writeFileSync(badRegistryPath, badRegistryContent, 'utf8');

  // 1. Sync without --force must fail with exit code 10 (ERR_BUDGET_VIOLATION)
  const failRes = spawnSync('node', [
    CLI_PATH,
    'sync',
    `--dest-dir=${stagingDir}`,
    `--registry=${badRegistryPath}`
  ], { encoding: 'utf8' });

  assert.equal(failRes.status, EXIT_CODES.ERR_BUDGET_VIOLATION, `Expected exit code 10, got ${failRes.status}`);
  const combinedFailOutput = failRes.stdout + failRes.stderr;
  assert.ok(combinedFailOutput.includes('Budget validation failed'), 'Missing budget validation failure notice');
  assert.ok(combinedFailOutput.includes('max_schema_tokens budget') || combinedFailOutput.includes('exceeds max_schema_tokens'), 'Missing token violation detail');

  // Verify no client configuration files were written
  const codexTarget = path.join(stagingDir, 'codex', 'config.toml');
  assert.equal(fs.existsSync(codexTarget), false, 'File was written despite budget violation');

  // 2. Sync with --force must bypass the budget failure and write configurations
  const forceRes = spawnSync('node', [
    CLI_PATH,
    'sync',
    '--force',
    `--dest-dir=${stagingDir}`,
    `--registry=${badRegistryPath}`
  ], { encoding: 'utf8' });

  assert.equal(forceRes.status, 0, `Forced sync failed: ${forceRes.stderr}`);
  assert.ok(forceRes.stdout.includes('[SYNCED] Codex CLI'), 'Missing forced sync notice for Codex');
  assert.ok(fs.existsSync(codexTarget), 'Target config file was not written with --force');

  const forcedCodexContent = fs.readFileSync(codexTarget, 'utf8');
  assert.ok(forcedCodexContent.includes('[mcp_servers.massive-server]'), 'Missing forced server in codex config');
});

// ---------------------------------------------------------------------------
// 5. Integration verification with utilities/node-process-janitor.ps1
// ---------------------------------------------------------------------------
test('e2e: node-process-janitor.ps1 integration verifies orphan/daemon cleanup rules cooperate with mcp governance', () => {
  assert.ok(fs.existsSync(JANITOR_SCRIPT_PATH), `Janitor script does not exist at ${JANITOR_SCRIPT_PATH}`);

  // 1. Execute janitor dry-run via PowerShell
  const dryRunRes = runPowerShell(['-File', JANITOR_SCRIPT_PATH]);
  assert.equal(dryRunRes.status, 0, `Janitor dry-run failed with code ${dryRunRes.status}: ${dryRunRes.stderr}`);
  assert.ok(dryRunRes.stdout.includes('=== Node Process Janitor ==='), 'Missing janitor header');
  assert.ok(dryRunRes.stdout.includes('Mode: dry-run'), 'Expected dry-run mode notice');
  assert.ok(dryRunRes.stdout.includes('IncludeSigil: no (default)'), 'Expected default Sigil exclusion');

  // 2. Execute janitor with custom parameters
  const customAgeRes = runPowerShell(['-File', JANITOR_SCRIPT_PATH, '-TestMaxAgeMinutes', '60']);
  assert.equal(customAgeRes.status, 0);
  assert.ok(customAgeRes.stdout.includes('TestMaxAgeMinutes: 60'), 'Did not honor TestMaxAgeMinutes flag');

  const sigilRes = runPowerShell(['-File', JANITOR_SCRIPT_PATH, '-IncludeSigil']);
  assert.equal(sigilRes.status, 0);
  assert.ok(sigilRes.stdout.includes('IncludeSigil: yes'), 'Did not honor IncludeSigil switch');

  // 3. Inspect janitor code rules to verify direct architectural cooperation with registry:
  const janitorScriptSource = fs.readFileSync(JANITOR_SCRIPT_PATH, 'utf8');

  // Rule 2 singleton class includes ijfw-mcp-server which matches canonical ijfw-memory MCP command
  assert.ok(
    janitorScriptSource.includes('ijfw-mcp-server') &&
    (janitorScriptSource.includes('mcp-server') || janitorScriptSource.includes('server.js')),
    'Janitor does not define ijfw-mcp-server singleton class for memory server'
  );

  // Default exclusion protects Sigil relay daemon & stdio processes
  assert.ok(
    janitorScriptSource.includes('Test-IsSigilProcess') &&
    janitorScriptSource.includes('IncludeSigil'),
    'Janitor missing Sigil process protection guard'
  );

  // Live parent PID check protects active CLI stdio subprocesses from orphan classification
  assert.ok(
    janitorScriptSource.includes('ParentAlive') || janitorScriptSource.includes('livePids'),
    'Janitor missing live parent PID protection logic'
  );
});

// ---------------------------------------------------------------------------
// 6. Live execution of node scripts/mcp-governance/cli.mjs status command
// ---------------------------------------------------------------------------
test('e2e: live cli.mjs status executes cleanly against repo with positive headroom across all clients', () => {
  const statusRes = spawnSync('node', [
    CLI_PATH,
    'status',
    `--registry=${CANONICAL_REGISTRY}`
  ], { encoding: 'utf8' });

  assert.equal(statusRes.status, 0, `Live status command failed: ${statusRes.stderr}`);
  const out = statusRes.stdout;

  // Verify dashboard visual presentation and metadata
  assert.ok(out.includes('MCP Governance Profile Manifest'), 'Missing table title');
  assert.ok(out.includes('2026-09-08'), 'Missing registry version in output');
  assert.ok(out.includes('Active Profile'), 'Missing Active Profile column header');
  assert.ok(out.includes('Headroom'), 'Missing Headroom column header');

  // Verify all supported clients are represented in the status dashboard
  const requiredClients = ['Codex CLI', 'Claude CLI', 'Claude Desktop', 'Antigravity', 'Grok'];
  for (const clientName of requiredClients) {
    assert.ok(out.includes(clientName), `Dashboard missing status row for ${clientName}`);
  }

  // Verify that all clients report OK status under canonical defaults
  assert.ok(out.includes('5 OK, 0 OVER_BUDGET'), 'Summary does not report 5 OK, 0 OVER_BUDGET');

  // Confirm headroom is positive (denoted by '+<number>' headroom)
  assert.ok(/\+\d+[\d,]*\s+/.test(out), 'No positive token headroom found in manifest output');

  // Log dashboard for visibility
  console.log('\n[E2E LIVE STATUS OUTPUT]\n' + out);
});
