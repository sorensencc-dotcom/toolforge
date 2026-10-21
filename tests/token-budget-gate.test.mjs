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
  // Use `node --experimental-default-type=commonjs` to execute it without changing the file
  const result = spawnSync('node', ['--experimental-default-type=commonjs', HOOK_PATH], {
    env: { ...process.env, ...env },
    cwd: WORK_DIR,
    encoding: 'utf8'
  });

  // Note: if that fails in older node, we could copy it to a .cjs file in the temp dir instead
  if (result.stderr.includes('require is not defined')) {
     const cjsPath = path.join(WORK_DIR, 'hook.cjs');
     fs.copyFileSync(HOOK_PATH, cjsPath);
     const result2 = spawnSync('node', [cjsPath], {
       env: { ...process.env, ...env },
       cwd: WORK_DIR,
       encoding: 'utf8'
     });
     return { status: result2.status, output: result2.stdout || '', stderr: result2.stderr || '' };
  }

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
