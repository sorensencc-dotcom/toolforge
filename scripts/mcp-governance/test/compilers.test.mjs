import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {
  compileCodexToml,
  compileClaudeJson,
  compileDesktopJson,
  compileGrokBridge,
  atomicWriteWithBackup,
  EXIT_CODES
} from '../compilers.mjs';

// --- Tests for compileCodexToml ---

test('compileCodexToml replaces only [mcp_servers] block and preserves comments/settings', () => {
  const input = `# User settings\nmodel = "gpt-5"\n\n[mcp_servers.old]\ncommand = "node"\n\n[plugins."test"]\nenabled = true\n`;
  const servers = {
    'kb-cache': { transport: 'stdio', command: 'node', args: ['C:/test.js'] }
  };
  const output = compileCodexToml(input, servers);
  assert.ok(output.includes('# User settings'), 'Should preserve top comment');
  assert.ok(output.includes('model = "gpt-5"'), 'Should preserve scalar setting');
  assert.ok(output.includes('[plugins."test"]'), 'Should preserve other tables');
  assert.ok(output.includes('enabled = true'), 'Should preserve other table keys');
  assert.ok(output.includes('[mcp_servers.kb-cache]'), 'Should add new mcp server');
  assert.ok(output.includes('command = "node"'), 'Should format command');
  assert.ok(output.includes('args = ["C:/test.js"]'), 'Should format args');
  assert.equal(output.includes('old'), false, 'Should remove old server');
});

test('compileCodexToml formats env sub-tables and sse urls correctly', () => {
  const input = `[other]\nfoo = "bar"\n`;
  const servers = {
    sigil: {
      transport: 'stdio',
      command: 'node',
      args: ['C:/dev/sigil.mjs'],
      env: { SIGIL_RUNTIME: 'codex', DEBUG: '1' }
    },
    github: {
      transport: 'sse',
      url: 'http://127.0.0.1:4411/mcp/github',
      bearer_token_env_var: 'GH_TOKEN'
    }
  };
  const output = compileCodexToml(input, servers);
  assert.ok(output.includes('[mcp_servers.sigil]'));
  assert.ok(output.includes('[mcp_servers.sigil.env]'));
  assert.ok(output.includes('SIGIL_RUNTIME = "codex"'));
  assert.ok(output.includes('DEBUG = "1"'));
  assert.ok(output.includes('[mcp_servers.github]'));
  assert.ok(output.includes('url = "http://127.0.0.1:4411/mcp/github"'));
  assert.ok(output.includes('bearer_token_env_var = "GH_TOKEN"'));
  // Internal registry fields should not appear
  assert.equal(output.includes('schema_weight'), false);
  assert.equal(output.includes('tags'), false);
});

test('compileCodexToml removes mcp_servers blocks cleanly when activeServers is empty', () => {
  const input = `# Codex Config\nmodel = "gpt-5"\n\n[mcp_servers.old]\ncommand = "node"\n\n[memories]\nenabled = true\n`;
  const output = compileCodexToml(input, {});
  assert.ok(output.includes('model = "gpt-5"'));
  assert.ok(output.includes('[memories]'));
  assert.equal(output.includes('[mcp_servers'), false);
  assert.equal(output.includes('old'), false);
});

test('compileCodexToml handles special characters in server names', () => {
  const input = ``;
  const servers = {
    'com.example.special-server@v1': {
      transport: 'stdio',
      command: 'node',
      args: ['start.js']
    }
  };
  const output = compileCodexToml(input, servers);
  assert.ok(output.includes('[mcp_servers."com.example.special-server@v1"]'));
});

// --- Tests for compileClaudeJson ---

test('compileClaudeJson replaces mcpServers object and preserves other keys', () => {
  const input = JSON.stringify({ theme: 'dark', otherSetting: 123, mcpServers: { old: {} } }, null, 2);
  const servers = {
    ijfw: { transport: 'stdio', command: 'node', args: ['server.js'], schema_weight: 1200 }
  };
  const output = compileClaudeJson(input, servers);
  const parsed = JSON.parse(output);
  assert.equal(parsed.theme, 'dark');
  assert.equal(parsed.otherSetting, 123);
  assert.ok(parsed.mcpServers.ijfw);
  assert.equal(parsed.mcpServers.ijfw.command, 'node');
  assert.deepEqual(parsed.mcpServers.ijfw.args, ['server.js']);
  assert.equal(parsed.mcpServers.ijfw.schema_weight, undefined);
  assert.equal(parsed.mcpServers.old, undefined);
});

test('compileClaudeJson preserves 4-space indentation and trailing newline', () => {
  const input = '{\n    "theme": "light",\n    "mcpServers": {}\n}\n';
  const servers = {
    demo: { command: 'python', args: ['-m', 'demo'] }
  };
  const output = compileClaudeJson(input, servers);
  assert.ok(output.includes('    "theme": "light"'));
  assert.ok(output.includes('    "mcpServers": {'));
  assert.ok(output.endsWith('\n'));
});

test('compileClaudeJson throws ERR_AST_PARSE_FAILURE on malformed JSON', () => {
  const malformedInput = '{ theme: "dark", unquotedKey: }';
  assert.throws(
    () => compileClaudeJson(malformedInput, {}),
    err => {
      assert.equal(err.exitCode, EXIT_CODES.ERR_AST_PARSE_FAILURE);
      return true;
    }
  );
});

test('compileClaudeJson throws ERR_CLIENT_CONFIG_INVALID if root is not an object', () => {
  const invalidRoot = '["not", "an", "object"]';
  assert.throws(
    () => compileClaudeJson(invalidRoot, {}),
    err => {
      assert.equal(err.exitCode, EXIT_CODES.ERR_CLIENT_CONFIG_INVALID);
      return true;
    }
  );
});

// --- Tests for compileDesktopJson ---

test('compileDesktopJson preserves complex claude desktop preferences', () => {
  const input = JSON.stringify({
    coworkUserFilesPath: 'C:\\Users\\test\\Documents',
    preferences: {
      sidebarMode: 'chat',
      coworkWebSearchEnabled: true
    },
    mcpServers: {
      stale: { command: 'old' }
    }
  }, null, 2);

  const servers = {
    'chrome-devtools': {
      transport: 'stdio',
      command: 'node',
      args: ['dist/index.js'],
      schema_weight: 4500,
      tags: ['browser']
    }
  };

  const output = compileDesktopJson(input, servers);
  const parsed = JSON.parse(output);
  assert.equal(parsed.coworkUserFilesPath, 'C:\\Users\\test\\Documents');
  assert.equal(parsed.preferences.sidebarMode, 'chat');
  assert.equal(parsed.preferences.coworkWebSearchEnabled, true);
  assert.ok(parsed.mcpServers['chrome-devtools']);
  assert.equal(parsed.mcpServers['chrome-devtools'].command, 'node');
  assert.equal(parsed.mcpServers['chrome-devtools'].schema_weight, undefined);
  assert.equal(parsed.mcpServers.stale, undefined);
});

// --- Tests for compileGrokBridge ---

test('compileGrokBridge formats mcpServers for Grok bridge and preserves settings', () => {
  const input = JSON.stringify({
    bridge_version: '1.0.0',
    bridge_mode: 'relay',
    mcpServers: { old: {} }
  }, null, 2);

  const servers = {
    'kb-context-cache': {
      transport: 'stdio',
      command: 'node',
      args: ['mcp-context-server.mjs']
    },
    github: {
      transport: 'sse',
      url: 'http://127.0.0.1:4411/mcp/github'
    }
  };

  const output = compileGrokBridge(input, servers);
  const parsed = JSON.parse(output);
  assert.equal(parsed.bridge_version, '1.0.0');
  assert.equal(parsed.bridge_mode, 'relay');
  assert.ok(parsed.mcpServers['kb-context-cache']);
  assert.ok(parsed.mcpServers.github);
  assert.equal(parsed.mcpServers.github.url, 'http://127.0.0.1:4411/mcp/github');
  assert.equal(parsed.mcpServers.old, undefined);
});

// --- Tests for atomicWriteWithBackup ---

test('atomicWriteWithBackup creates backup, writes new content atomically, and returns backupPath', () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mcp-compilers-test-'));
  const targetFile = path.join(tempDir, 'test-config.json');
  const originalContent = '{"initial": true}\n';
  const newContent = '{"updated": true}\n';

  fs.writeFileSync(targetFile, originalContent, 'utf8');

  const result = atomicWriteWithBackup(targetFile, newContent);
  assert.equal(result.success, true);
  assert.ok(result.backupPath);
  assert.ok(fs.existsSync(result.backupPath), 'Backup file must exist');
  assert.equal(fs.readFileSync(result.backupPath, 'utf8'), originalContent, 'Backup must contain original content');
  assert.equal(fs.readFileSync(targetFile, 'utf8'), newContent, 'Target must contain updated content');

  // Clean up
  fs.rmSync(tempDir, { recursive: true, force: true });
});

test('atomicWriteWithBackup works when target file does not exist initially', () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mcp-compilers-test-'));
  const targetFile = path.join(tempDir, 'new-config.json');
  const newContent = '{"created": true}\n';

  const result = atomicWriteWithBackup(targetFile, newContent);
  assert.equal(result.success, true);
  assert.equal(result.backupPath, null, 'No backup should exist for newly created file');
  assert.equal(fs.readFileSync(targetFile, 'utf8'), newContent);

  // Clean up
  fs.rmSync(tempDir, { recursive: true, force: true });
});

test('atomicWriteWithBackup restores from backup and throws ERR_ATOMIC_WRITE_FAILURE on failure', () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mcp-compilers-test-'));
  const targetFile = path.join(tempDir, 'locked-config.json');
  const originalContent = '{"stable": true}\n';

  fs.writeFileSync(targetFile, originalContent, 'utf8');

  // Force atomicWriteWithBackup to fail by passing a directory as target
  // or testing with invalid destination
  const dirAsFile = path.join(tempDir, 'a-dir');
  fs.mkdirSync(dirAsFile);

  assert.throws(
    () => atomicWriteWithBackup(dirAsFile, 'content'),
    err => {
      assert.equal(err.exitCode, EXIT_CODES.ERR_ATOMIC_WRITE_FAILURE);
      return true;
    }
  );

  // Clean up
  fs.rmSync(tempDir, { recursive: true, force: true });
});

test('compileCodexToml supports Map input and handles Windows backslash paths cleanly', () => {
  const input = `[settings]\nactive = true\n`;
  const serverMap = new Map();
  serverMap.set('local-python', {
    transport: 'stdio',
    command: 'C:\\Python314\\python.exe',
    args: ['-u', 'C:\\dev\\script.py'],
    enabled: false
  });

  const output = compileCodexToml(input, serverMap);
  assert.ok(output.includes('[mcp_servers.local-python]'));
  assert.ok(output.includes('command = "C:\\\\Python314\\\\python.exe"'));
  assert.ok(output.includes('args = ["-u", "C:\\\\dev\\\\script.py"]'));
  assert.ok(output.includes('enabled = false'));
});

test('compileClaudeJson handles empty string input gracefully', () => {
  const servers = {
    minimal: { command: 'node', args: ['min.js'] }
  };
  const output = compileClaudeJson('', servers);
  const parsed = JSON.parse(output);
  assert.ok(parsed.mcpServers.minimal);
  assert.equal(parsed.mcpServers.minimal.command, 'node');
});

test('atomicWriteWithBackup creates missing nested directories', () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mcp-compilers-test-'));
  const nestedTarget = path.join(tempDir, 'sub', 'dir', 'config.json');

  const result = atomicWriteWithBackup(nestedTarget, '{"nested": true}\n');
  assert.equal(result.success, true);
  assert.ok(fs.existsSync(nestedTarget));
  assert.equal(fs.readFileSync(nestedTarget, 'utf8'), '{"nested": true}\n');

  // Clean up
  fs.rmSync(tempDir, { recursive: true, force: true });
});

