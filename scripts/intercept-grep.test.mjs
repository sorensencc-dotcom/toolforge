import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const interceptScript = path.resolve(__dirname, 'intercept-grep.js');

function runInterceptor(args = [], input = '') {
  return spawnSync(process.execPath, [interceptScript, ...args], {
    input,
    encoding: 'utf8',
  });
}

test('blocks broad recursive grep across directory', () => {
  const result = runInterceptor(['grep -rn "mySymbol" .']);
  assert.equal(result.status, 1);
  assert.match(result.stderr, /TOOL REDIRECT: DETERMINISTIC CODE GRAPH/);
  assert.match(result.stderr, /mcp__graft__graft_trace_calls/);
  assert.match(result.stderr, /mcp__graft__graft_file_api/);
});

test('blocks broad ripgrep across workspace', () => {
  const result = runInterceptor(['rg "TODO"']);
  assert.equal(result.status, 1);
  assert.match(result.stderr, /TOOL REDIRECT: DETERMINISTIC CODE GRAPH/);
});

test('blocks git grep across repo', () => {
  const result = runInterceptor(['git grep "function"']);
  assert.equal(result.status, 1);
  assert.match(result.stderr, /TOOL REDIRECT: DETERMINISTIC CODE GRAPH/);
});

test('allows single-file search targeting concrete file extension', () => {
  const result = runInterceptor(['grep -n "error" log.txt']);
  assert.equal(result.status, 0);
  assert.equal(result.stderr, '');
});

test('allows piped commands reading from stdin stream', () => {
  const result = runInterceptor(['git status -s | grep modified']);
  assert.equal(result.status, 0);
  assert.equal(result.stderr, '');
});

test('blocks chained command containing broad grep', () => {
  const result = runInterceptor(['cat notes.txt && grep -rn "foo" .']);
  assert.equal(result.status, 1);
  assert.match(result.stderr, /TOOL REDIRECT: DETERMINISTIC CODE GRAPH/);
});

test('allows chained command with only targeted single-file searches', () => {
  const result = runInterceptor(['cat notes.txt && grep -n "foo" log.txt']);
  assert.equal(result.status, 0);
  assert.equal(result.stderr, '');
});

test('processes Claude Code JSON hook payload over stdin', () => {
  const payload = JSON.stringify({
    tool: {
      name: 'Bash',
      input: {
        command: 'grep -rn "needle" .',
      },
    },
  });
  const result = runInterceptor([], payload);
  assert.equal(result.status, 1);
  assert.match(result.stderr, /TOOL REDIRECT: DETERMINISTIC CODE GRAPH/);
});
