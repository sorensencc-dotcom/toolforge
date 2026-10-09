import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const script = readFileSync(resolve('utilities/setup-task-scheduler.ps1'), 'utf8');

test('scheduled task script path points at a file in this repo', () => {
  const line = script.split(/\r?\n/).find((l) => l.startsWith('$ScriptPath ='));
  assert.ok(line, 'no $ScriptPath assignment found');
  const value = line.slice(line.indexOf('"') + 1, line.lastIndexOf('"'));
  const prefix = 'C:' + String.fromCharCode(92) + 'dev' + String.fromCharCode(92);
  assert.ok(value.startsWith(prefix), `${value} is not under ${prefix}`);
  const relative = value.slice(prefix.length).split(String.fromCharCode(92)).join('/');
  assert.ok(existsSync(resolve(relative)), `${relative} does not exist in the repo`);
});
