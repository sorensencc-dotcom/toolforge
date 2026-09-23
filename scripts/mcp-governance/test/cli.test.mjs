import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { execFileSync, spawnSync } from 'node:child_process';
import {
  runCli,
  resolveClientPath,
  renderStatusDashboard,
  validateCommand,
  syncCommand,
  setProfileCommand,
  getProfileCommand,
  listProfilesCommand,
  CLIENT_METADATA,
  DEFAULT_CLIENT_PROFILES
} from '../cli.mjs';
import { EXIT_CODES } from '../registry.mjs';

const CLI_PATH = path.resolve('C:/dev/scripts/mcp-governance/cli.mjs');
const CANONICAL_REGISTRY = path.resolve('C:/dev/.sigil/mcp-registry.toml');

function makeTempDir(prefix = 'mcp-cli-test-') {
  return fs.mkdtempSync(path.join(os.tmpdir(), prefix));
}

test('cli status returns active profile manifest dashboard table with headroom', () => {
  const res = spawnSync('node', [CLI_PATH, 'status'], {
    encoding: 'utf8',
    env: { ...process.env }
  });

  assert.equal(res.status, 0, `Expected status 0, got ${res.status}: ${res.stderr}`);
  const out = res.stdout;
  assert.ok(out.includes('MCP Governance Profile Manifest'), 'Missing manifest title');
  assert.ok(out.includes('Active Profile'), 'Missing Active Profile header');
  assert.ok(out.includes('Headroom'), 'Missing Headroom header');
  assert.ok(out.includes('Codex CLI'), 'Missing Codex CLI client');
  assert.ok(out.includes('Claude CLI'), 'Missing Claude CLI client');
  assert.ok(out.includes('Claude Desktop'), 'Missing Claude Desktop client');
  assert.ok(out.includes('Antigravity'), 'Missing Antigravity client');
  assert.ok(out.includes('Grok'), 'Missing Grok client');
  assert.ok(out.includes('OK'), 'Missing OK status');
});

test('cli status exits with 10 on budget violation', () => {
  const tmpDir = makeTempDir();
  const badRegistryPath = path.join(tmpDir, 'bad-registry.toml');
  const badSettingsPath = path.join(tmpDir, 'mcp-settings.json');

  const badRegistryContent = `
registry_version = "2026-09-08"
schema_version = 1

[profiles.overflown]
description = "Over budget profile"
max_tools = 1
max_schema_tokens = 500
servers = ["s1", "s2"]

[servers.s1]
transport = "stdio"
command = "node"
schema_weight = 400

[servers.s2]
transport = "stdio"
command = "node"
schema_weight = 300
`;

  const settingsContent = JSON.stringify({
    activeProfiles: {
      codex: 'overflown'
    }
  });

  fs.writeFileSync(badRegistryPath, badRegistryContent, 'utf8');
  fs.writeFileSync(badSettingsPath, settingsContent, 'utf8');

  const res = spawnSync('node', [
    CLI_PATH,
    'status',
    `--registry=${badRegistryPath}`,
    `--settings=${badSettingsPath}`
  ], { encoding: 'utf8' });

  assert.equal(res.status, EXIT_CODES.ERR_BUDGET_VIOLATION);
  assert.ok(res.stdout.includes('OVER_BUDGET'));
});

test('cli validate exits 0 on valid canonical registry and includes PASS', () => {
  const res = spawnSync('node', [CLI_PATH, 'validate'], { encoding: 'utf8' });
  assert.equal(res.status, 0);
  assert.ok(res.stdout.includes('PASS'));
  assert.ok(res.stdout.includes('Profiles Validated'));
});

test('cli validate exits 10 on budget overrun', () => {
  const tmpDir = makeTempDir();
  const badRegPath = path.join(tmpDir, 'budget-overrun.toml');
  const content = `
registry_version = "2026-09-08"
schema_version = 1

[profiles.overflow]
max_tools = 1
max_schema_tokens = 100
servers = ["heavy"]

[servers.heavy]
transport = "stdio"
command = "node"
schema_weight = 500
`;
  fs.writeFileSync(badRegPath, content, 'utf8');

  const res = spawnSync('node', [CLI_PATH, 'validate', `--registry=${badRegPath}`], { encoding: 'utf8' });
  assert.equal(res.status, EXIT_CODES.ERR_BUDGET_VIOLATION);
  assert.ok(res.stderr.includes('FAIL') || res.stdout.includes('FAIL'));
  assert.ok((res.stderr + res.stdout).includes('exceeds max_schema_tokens budget'));
});

test('cli validate exits 50 on schema error (undefined server reference)', () => {
  const tmpDir = makeTempDir();
  const badRegPath = path.join(tmpDir, 'schema-error.toml');
  const content = `
registry_version = "2026-09-08"
schema_version = 1

[profiles.broken]
max_tools = 5
max_schema_tokens = 5000
servers = ["ghost-server"]

[servers.real]
transport = "stdio"
command = "node"
schema_weight = 100
`;
  fs.writeFileSync(badRegPath, content, 'utf8');

  const res = spawnSync('node', [CLI_PATH, 'validate', `--registry=${badRegPath}`], { encoding: 'utf8' });
  assert.equal(res.status, EXIT_CODES.ERR_REGISTRY_SCHEMA_INVALID);
  assert.ok((res.stderr + res.stdout).includes('references undefined server'));
});

test('cli sync --dry-run prints preview without creating or modifying files on disk', () => {
  const tmpDir = makeTempDir();
  const res = spawnSync('node', [
    CLI_PATH,
    'sync',
    '--dry-run',
    `--dest-dir=${tmpDir}`,
    `--registry=${CANONICAL_REGISTRY}`
  ], { encoding: 'utf8' });

  assert.equal(res.status, 0);
  assert.ok(res.stdout.includes('[DRY-RUN]'));
  assert.ok(res.stdout.includes('Codex CLI'));
  assert.ok(res.stdout.includes('Claude CLI'));
  assert.ok(res.stdout.includes('Claude Desktop'));

  // Ensure no files were actually created in tmpDir
  const files = fs.readdirSync(tmpDir);
  assert.equal(files.length, 0, 'Files were written to disk during dry run');
});

test('cli sync writes configs atomically with backups for all clients', () => {
  const tmpDir = makeTempDir();
  const codexDir = path.join(tmpDir, 'codex');
  fs.mkdirSync(codexDir, { recursive: true });

  const initialCodexToml = `# Custom User Header\nmodel = "gpt-5"\n\n[mcp_servers.old]\ncommand = "old-node"\n`;
  const codexPath = path.join(codexDir, 'config.toml');
  fs.writeFileSync(codexPath, initialCodexToml, 'utf8');

  const res = spawnSync('node', [
    CLI_PATH,
    'sync',
    `--dest-dir=${tmpDir}`,
    `--registry=${CANONICAL_REGISTRY}`
  ], { encoding: 'utf8' });

  assert.equal(res.status, 0, `Sync failed: ${res.stderr}`);
  assert.ok(res.stdout.includes('[SYNCED]'));

  // Check that backup file was created for existing file
  assert.ok(fs.existsSync(`${codexPath}.bak`), 'Backup file was not created');
  const backupContent = fs.readFileSync(`${codexPath}.bak`, 'utf8');
  assert.equal(backupContent, initialCodexToml);

  // Check that codex config preserved user comments and model
  const updatedCodex = fs.readFileSync(codexPath, 'utf8');
  assert.ok(updatedCodex.includes('# Custom User Header'));
  assert.ok(updatedCodex.includes('model = "gpt-5"'));
  assert.ok(updatedCodex.includes('[mcp_servers.kb-context-cache]'));
  assert.equal(updatedCodex.includes('[mcp_servers.old]'), false);

  // Check that Claude and Desktop files were written
  const claudePath = path.join(tmpDir, 'claude', '.claude.json');
  assert.ok(fs.existsSync(claudePath));
  const claudeJson = JSON.parse(fs.readFileSync(claudePath, 'utf8'));
  assert.ok(claudeJson.mcpServers);
  assert.ok(claudeJson.mcpServers['kb-context-cache']);

  const desktopPath = path.join(tmpDir, 'desktop', 'claude_desktop_config.json');
  assert.ok(fs.existsSync(desktopPath));
  const desktopJson = JSON.parse(fs.readFileSync(desktopPath, 'utf8'));
  assert.ok(desktopJson.mcpServers['github']);
});

test('cli sync --client targets single client', () => {
  const tmpDir = makeTempDir();
  const res = spawnSync('node', [
    CLI_PATH,
    'sync',
    '--client=codex',
    `--dest-dir=${tmpDir}`,
    `--registry=${CANONICAL_REGISTRY}`
  ], { encoding: 'utf8' });

  assert.equal(res.status, 0);
  const codexPath = path.join(tmpDir, 'codex', 'config.toml');
  assert.ok(fs.existsSync(codexPath));

  // Verify other client files were NOT created
  const claudePath = path.join(tmpDir, 'claude', '.claude.json');
  assert.equal(fs.existsSync(claudePath), false);
});

test('cli sync aborts on budget violation without --force', () => {
  const tmpDir = makeTempDir();
  const badRegPath = path.join(tmpDir, 'budget-overrun.toml');
  const content = `
registry_version = "2026-09-08"
schema_version = 1

[profiles.dev]
max_tools = 1
max_schema_tokens = 200
servers = ["heavy"]

[profiles.full]
max_tools = 1
max_schema_tokens = 200
servers = ["heavy"]

[profiles.dev-minimal]
max_tools = 1
max_schema_tokens = 200
servers = ["heavy"]

[servers.heavy]
transport = "stdio"
command = "node"
schema_weight = 500
`;
  fs.writeFileSync(badRegPath, content, 'utf8');

  // Should abort with 10
  const res = spawnSync('node', [
    CLI_PATH,
    'sync',
    `--registry=${badRegPath}`,
    `--dest-dir=${tmpDir}`
  ], { encoding: 'utf8' });

  assert.equal(res.status, EXIT_CODES.ERR_BUDGET_VIOLATION);
  assert.ok((res.stderr + res.stdout).includes('Budget validation failed'));

  // With --force, should succeed
  const forceRes = spawnSync('node', [
    CLI_PATH,
    'sync',
    '--force',
    `--registry=${badRegPath}`,
    `--dest-dir=${tmpDir}`
  ], { encoding: 'utf8' });

  assert.equal(forceRes.status, 0);
});

test('cli profile set updates active profile and status reflects changes', () => {
  const tmpDir = makeTempDir();
  const settingsPath = path.join(tmpDir, 'mcp-settings.json');

  // Set codex profile to minimal
  const setRes = spawnSync('node', [
    CLI_PATH,
    'profile',
    'set',
    'codex',
    'minimal',
    `--registry=${CANONICAL_REGISTRY}`,
    `--settings=${settingsPath}`
  ], { encoding: 'utf8' });

  assert.equal(setRes.status, 0, `setProfile failed: ${setRes.stderr}`);
  assert.ok(setRes.stdout.includes('Updated active profile'));

  // Verify settings file on disk
  const settings = JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
  assert.equal(settings.activeProfiles.codex, 'minimal');

  // Verify status reflects minimal profile for codex
  const statusRes = spawnSync('node', [
    CLI_PATH,
    'status',
    `--registry=${CANONICAL_REGISTRY}`,
    `--settings=${settingsPath}`
  ], { encoding: 'utf8' });

  assert.equal(statusRes.status, 0);
  assert.ok(statusRes.stdout.includes('minimal'));
});

test('cli profile set rejects unknown client with error code 40', () => {
  const res = spawnSync('node', [
    CLI_PATH,
    'profile',
    'set',
    'nonexistent-client',
    'dev'
  ], { encoding: 'utf8' });

  assert.equal(res.status, EXIT_CODES.ERR_CLIENT_CONFIG_INVALID);
  assert.ok((res.stderr + res.stdout).includes('Unknown client'));
});

test('cli profile set rejects unknown profile with error code 50', () => {
  const res = spawnSync('node', [
    CLI_PATH,
    'profile',
    'set',
    'codex',
    'ghost-profile-xyz',
    `--registry=${CANONICAL_REGISTRY}`
  ], { encoding: 'utf8' });

  assert.equal(res.status, EXIT_CODES.ERR_REGISTRY_SCHEMA_INVALID);
  assert.ok((res.stderr + res.stdout).includes('does not exist in registry'));
});

test('cli help displays usage instructions and exits 0', () => {
  const res = spawnSync('node', [CLI_PATH, '--help'], { encoding: 'utf8' });
  assert.equal(res.status, 0);
  assert.ok(res.stdout.includes('Usage:'));
  assert.ok(res.stdout.includes('status'));
  assert.ok(res.stdout.includes('validate'));
  assert.ok(res.stdout.includes('sync'));
  assert.ok(res.stdout.includes('profile'));
});

test('programmatic exports renderStatusDashboard and resolveClientPath work directly', () => {
  const resolved = resolveClientPath('codex', { destDir: 'C:/temp/test' });
  assert.ok(resolved.includes('config.toml'));

  const statusObj = renderStatusDashboard({ registryPath: CANONICAL_REGISTRY });
  assert.equal(statusObj.allOk, true);
  assert.equal(statusObj.rows.length, 5);
  assert.ok(statusObj.tableText.includes('Codex CLI'));
});
