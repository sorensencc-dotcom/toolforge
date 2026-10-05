import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const content = readFileSync(resolve('scripts/reconcile-scheduled-tasks.ps1'), 'utf8');

function taskBlock(name) {
  const start = content.indexOf(`TaskName = "${name}"`);
  assert.notEqual(start, -1, `${name} missing from reconciler`);
  return content.slice(start, content.indexOf('},', start));
}

test('weekly retro task stays on run-weekly-retro.ps1', () => {
  const block = taskBlock('toolforge-weekly-report-agent');
  assert.match(block, /run-weekly-retro\.ps1/);
});

test('weekly Markdown report task runs weekly-report-agent.ps1 on Sundays', () => {
  const block = taskBlock('toolforge-weekly-report-md-agent');
  assert.match(block, /weekly-report-agent\.ps1/);
  assert.match(block, /TriggerType = "Weekly"/);
  assert.match(block, /TriggerDay = "Sunday"/);
});

test('retro and Markdown report tasks do not share a start time', () => {
  const time = (name) => taskBlock(name).match(/TriggerTime = "([^"]+)"/)[1];
  assert.notEqual(time('toolforge-weekly-report-agent'), time('toolforge-weekly-report-md-agent'));
});
