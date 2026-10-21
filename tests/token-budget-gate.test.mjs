import test from 'node:test';
import assert from 'node:assert';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const HOOK_PATH = path.join(__dirname, '../.claude/hooks/token-budget-gate.js');
const EDITS_FILE = '.ijfw/.session-edits.jsonl';
const WORK_DIR = path.join(__dirname, 'test-workdir');

function runHook(env = {}) {
  // The hook is CommonJS; copy it to .cjs so it runs regardless of the repo's package type.
  fs.mkdirSync(WORK_DIR, { recursive: true });
  const cjsPath = path.join(WORK_DIR, 'hook.cjs');
  fs.copyFileSync(HOOK_PATH, cjsPath);
  const result = spawnSync(process.execPath, [cjsPath], {
    env: { ...process.env, ...env },
    cwd: WORK_DIR,
    encoding: 'utf8'
  });
  return { status: result.status, output: result.stdout || '', stderr: result.stderr || '' };
}

test('token-budget-gate.js handles malformed JSON lines in .session-edits.jsonl gracefully', (t) => {
  fs.mkdirSync(path.join(WORK_DIR, '.ijfw'), { recursive: true });
  const editsPath = path.join(WORK_DIR, EDITS_FILE);

  const fileContent = [
    '{"added": 10}',
    'THIS IS A MALFORMED JSON LINE THAT WOULD CAUSE JSON.parse TO CRASH',
    '{"added": 20, "removed": 5}'
  ].join('\n');
  fs.writeFileSync(editsPath, fileContent);

  const result = runHook({ LOC_THRESHOLD: '100', COMMIT_THRESHOLD: '999' });

  fs.rmSync(WORK_DIR, { recursive: true, force: true });

  const fullOutput = result.output + '\n' + result.stderr;
  assert.ok(fullOutput.includes('Session LOC: 35'), `Should correctly sum LOC from valid lines. Output: ${fullOutput}`);
});

test('token-budget-gate.js handles missing edits log gracefully', (t) => {
  fs.mkdirSync(path.join(WORK_DIR, '.ijfw'), { recursive: true });

  const result = runHook({ LOC_THRESHOLD: '100', COMMIT_THRESHOLD: '999' });

  fs.rmSync(WORK_DIR, { recursive: true, force: true });

  const fullOutput = result.output + '\n' + result.stderr;
  assert.ok(fullOutput.includes('Session LOC: 0'), `Should default to 0 LOC. Output: ${fullOutput}`);
});
