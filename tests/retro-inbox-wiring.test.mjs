import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const read = (relative) => readFileSync(fileURLToPath(new URL(`../${relative}`, import.meta.url)), 'utf8');
const VALIDATE = 'node scripts/validate-retro-inbox.mjs';

function jobBlock(workflow, job) {
  const lines = workflow.split(/\r?\n/);
  const start = lines.findIndex((line) => line === `  ${job}:`);
  assert.notEqual(start, -1, `job ${job} exists`);
  const end = lines.findIndex((line, index) => index > start && /^ {2}[\w-]+:\s*$/.test(line));
  return lines.slice(start, end === -1 ? undefined : end).join('\n');
}

test('governance workflow validates the retro inbox on every pull request', () => {
  const workflow = read('.github/workflows/governance.yml');
  assert.match(workflow, /^on:\s*\r?\n(?:.*\r?\n)*?\s+pull_request:/m);
  const job = jobBlock(workflow, 'retro-inbox');
  assert.ok(job.includes(VALIDATE), 'job runs the inbox validator');
  assert.match(job, /actions\/setup-node@/);
});

test('governance workflow never asks CI to read the gitignored TODOS.md', () => {
  assert.ok(!jobBlock(read('.github/workflows/governance.yml'), 'retro-inbox').includes('TODOS.md'));
});

test('nightly retro audit validates the inbox before the freshness check', () => {
  const workflow = read('.github/workflows/retro-full-audit.yml');
  const inbox = workflow.indexOf(VALIDATE);
  assert.notEqual(inbox, -1);
  assert.ok(inbox < workflow.indexOf('Check retro freshness'));
  assert.ok(workflow.lastIndexOf('actions/setup-node@', inbox) !== -1, 'Node is set up first');
});

test('pre-commit shim validates the inbox only when inbox files are staged', () => {
  const shim = read('CIC-GOVERNANCE/scripts/pre-commit-shim.sh');
  const line = shim.split('\n').find((candidate) => candidate.includes('validate-retro-inbox.mjs') && candidate.startsWith('if'));
  assert.ok(line, 'shim has a guarded inbox gate');
  assert.ok(line.includes('git diff --cached --name-only'));
  assert.ok(line.includes('^' + String.fromCharCode(92) + '.context/retros/inbox/'));
  assert.ok(shim.includes('node scripts/validate-retro-inbox.mjs ||'));
});

test('retro policy names the consolidator as the tool that applies the rule', () => {
  const policy = read('docs/meta/governance/retro-policy.md');
  assert.ok(policy.includes('scripts/consolidate-retro-inbox.mjs'));
  assert.ok(!policy.includes('No tool applies this rule yet'));
});
