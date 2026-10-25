import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { validateGrokHooks } from '../scripts/check-grok-hooks.mjs';

const scriptPath = fileURLToPath(new URL('../scripts/check-grok-hooks.mjs', import.meta.url));

function createMockGrokEnv({
  claudeHooks = 'false',
  cursorHooks = 'false',
  codexHooks = 'false',
  cmHooks = {},
  spHooks = null,
  personalHooks = {},
} = {}) {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'grok-guardrail-test-'));

  // config.toml
  const configToml = `
[compat.claude]
hooks = ${claudeHooks}

[compat.cursor]
hooks = ${cursorHooks}

[compat.codex]
hooks = ${codexHooks}
`;
  fs.writeFileSync(path.join(tmpDir, 'config.toml'), configToml, 'utf8');

  // claude-mem overlay
  const cmDir = path.join(tmpDir, 'plugins', 'claude-mem', 'hooks');
  fs.mkdirSync(cmDir, { recursive: true });
  fs.writeFileSync(path.join(cmDir, 'hooks.json'), JSON.stringify({ hooks: cmHooks }), 'utf8');

  // superpowers overlay
  const spDir = path.join(tmpDir, 'plugins', 'superpowers', 'hooks');
  fs.mkdirSync(spDir, { recursive: true });
  const spContent = spHooks || JSON.stringify({
    hooks: {
      SessionStart: [
        {
          hooks: [{ type: 'command', command: 'C:/some/real/path.cmd' }],
        },
      ],
    },
  });
  fs.writeFileSync(path.join(spDir, 'hooks.json'), spContent, 'utf8');

  // personal hooks
  const hooksDir = path.join(tmpDir, 'hooks');
  fs.mkdirSync(hooksDir, { recursive: true });
  for (const [name, content] of Object.entries(personalHooks)) {
    fs.writeFileSync(path.join(hooksDir, name), JSON.stringify(content), 'utf8');
  }

  return tmpDir;
}

test('live environment passes all guardrail validations', () => {
  const res = validateGrokHooks({ fast: true, skipLive: false });
  assert.equal(res.valid, true, `Expected valid live config, got issues: ${res.issues.join('; ')}`);
  assert.equal(res.issues.length, 0);
});

test('detects when [compat.claude] hooks is true', () => {
  const tmpDir = createMockGrokEnv({ claudeHooks: 'true' });
  try {
    const res = validateGrokHooks({ grokHome: tmpDir, fast: true, skipLive: true });
    assert.equal(res.valid, false);
    assert.ok(res.issues.some(i => i.includes('[compat.claude] hooks is \'true\'')));
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

test('detects when [compat.claude] hooks block is missing', () => {
  const tmpDir = createMockGrokEnv();
  // Overwrite config without claude block
  fs.writeFileSync(path.join(tmpDir, 'config.toml'), '[compat.cursor]\nhooks = false\n', 'utf8');
  try {
    const res = validateGrokHooks({ grokHome: tmpDir, fast: true, skipLive: true });
    assert.equal(res.valid, false);
    assert.ok(res.issues.some(i => i.includes("Missing '[compat.claude] hooks = false'")));
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

test('detects when [compat.cursor] hooks is true', () => {
  const tmpDir = createMockGrokEnv({ cursorHooks: 'true' });
  try {
    const res = validateGrokHooks({ grokHome: tmpDir, fast: true, skipLive: true });
    assert.equal(res.valid, false);
    assert.ok(res.issues.some(i => i.includes('[compat.cursor] hooks is \'true\'')));
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

test('detects when [compat.cursor] hooks block is missing', () => {
  const tmpDir = createMockGrokEnv();
  fs.writeFileSync(path.join(tmpDir, 'config.toml'), '[compat.claude]\nhooks = false\n', 'utf8');
  try {
    const res = validateGrokHooks({ grokHome: tmpDir, fast: true, skipLive: true });
    assert.equal(res.valid, false);
    assert.ok(res.issues.some(i => i.includes("Missing '[compat.cursor] hooks = false'")));
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

test('detects synchronous PostToolUse in claude-mem overlay', () => {
  const tmpDir = createMockGrokEnv({
    cmHooks: {
      PostToolUse: [
        {
          hooks: [{ type: 'command', command: 'claude-mem hook observation' }],
        },
      ],
    },
  });
  try {
    const res = validateGrokHooks({ grokHome: tmpDir, fast: true, skipLive: true });
    assert.equal(res.valid, false);
    assert.ok(res.issues.some(i => i.includes("claude-mem overlay defines 'PostToolUse' hooks")));
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

test('detects synchronous PreToolUse in claude-mem overlay', () => {
  const tmpDir = createMockGrokEnv({
    cmHooks: {
      PreToolUse: [
        {
          hooks: [{ type: 'command', command: 'claude-mem hook file-context' }],
        },
      ],
    },
  });
  try {
    const res = validateGrokHooks({ grokHome: tmpDir, fast: true, skipLive: true });
    assert.equal(res.valid, false);
    assert.ok(res.issues.some(i => i.includes("claude-mem overlay defines 'PreToolUse' hooks")));
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

test('detects unexpanded ${CLAUDE_PLUGIN_ROOT} in superpowers overlay', () => {
  const tmpDir = createMockGrokEnv({
    spHooks: JSON.stringify({
      hooks: {
        SessionStart: [
          {
            hooks: [{ type: 'command', command: '${CLAUDE_PLUGIN_ROOT}/hooks/run-hook.cmd' }],
          },
        ],
      },
    }),
  });
  try {
    const res = validateGrokHooks({ grokHome: tmpDir, fast: true, skipLive: true });
    assert.equal(res.valid, false);
    assert.ok(res.issues.some(i => i.includes('Unexpanded variable ${CLAUDE_PLUGIN_ROOT}')));
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

test('flags tool hooks lacking explicit short timeout', () => {
  const tmpDir = createMockGrokEnv({
    personalHooks: {
      'custom-tool-hook.json': {
        hooks: {
          PostToolUse: [
            {
              hooks: [{ type: 'command', command: 'echo done', timeout: 30 }],
            },
          ],
        },
      },
    },
  });
  try {
    const res = validateGrokHooks({ grokHome: tmpDir, fast: true, skipLive: true });
    assert.equal(res.valid, false);
    assert.ok(res.issues.some(i => i.includes('must specify timeout <= 5s')));
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

test('warns on hooks with excessive timeouts (> 15s)', () => {
  const tmpDir = createMockGrokEnv({
    personalHooks: {
      'long-hook.json': {
        hooks: {
          SessionStart: [
            {
              hooks: [{ type: 'command', command: 'echo starting', timeout: 45 }],
            },
          ],
        },
      },
    },
  });
  try {
    const res = validateGrokHooks({ grokHome: tmpDir, fast: true, skipLive: true });
    assert.equal(res.valid, true);
    assert.ok(res.warnings.some(w => w.includes('excessive timeout of 45s')));
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

test('CLI check-grok-hooks.mjs exits 0 on valid directory', () => {
  const r = spawnSync(process.execPath, [scriptPath, '--fast'], {
    encoding: 'utf8',
  });
  assert.equal(r.status, 0);
  assert.ok(r.stdout.includes('[grok-guardrail:PASS]'));
});

test('CLI check-grok-hooks.mjs exits 1 on invalid directory', () => {
  const tmpDir = createMockGrokEnv({ claudeHooks: 'true' });
  try {
    const r = spawnSync(process.execPath, [scriptPath, '--fast', '--grok-home', tmpDir], {
      encoding: 'utf8',
    });
    assert.equal(r.status, 1);
    assert.ok(r.stderr.includes('[grok-guardrail:FAIL]'));
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

test('Grok guardrail-check hook file is correctly installed', () => {
  const hookFile = path.join(os.homedir(), '.grok', 'hooks', 'guardrail-check.json');
  assert.ok(fs.existsSync(hookFile), 'guardrail-check.json must exist in ~/.grok/hooks/');
  const data = JSON.parse(fs.readFileSync(hookFile, 'utf8'));
  assert.ok(data.hooks.SessionStart, 'SessionStart hook must be defined');
  const cmd = data.hooks.SessionStart[0].hooks[0].command;
  assert.ok(cmd.includes('check-grok-hooks.mjs'), 'Hook must call check-grok-hooks.mjs');
});

test('handles and flags malformed JSON in personal hook files', () => {
  const tmpDir = createMockGrokEnv();
  fs.writeFileSync(path.join(tmpDir, 'hooks', 'broken.json'), '{ not valid json', 'utf8');
  try {
    const res = validateGrokHooks({ grokHome: tmpDir, fast: true, skipLive: true });
    assert.equal(res.valid, false);
    assert.ok(res.issues.some(i => i.includes('Invalid JSON in')));
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

test('fast validation runs in under 100ms', () => {
  const start = performance.now();
  const res = validateGrokHooks({ fast: true, skipLive: true });
  const duration = performance.now() - start;
  assert.equal(res.valid, true);
  assert.ok(duration < 100, `Expected fast check < 100ms, took ${duration.toFixed(2)}ms`);
});

test('full live inspection confirms zero hook load errors from grok.exe', () => {
  const res = validateGrokHooks({ fast: false, skipLive: false });
  assert.equal(res.valid, true);
  assert.equal(res.issues.length, 0);
});
