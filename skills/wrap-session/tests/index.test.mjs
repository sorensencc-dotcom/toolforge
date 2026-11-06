import test from 'node:test';
import assert from 'node:assert/strict';
import { retroDecision, checkRetroNeeded, buildStatusSection, insertSection } from '../src/index.mjs';

test('retroDecision maps exit codes', () => {
  assert.equal(retroDecision(0), 'run');
  assert.equal(retroDecision(1), 'skip');
  assert.throws(() => retroDecision(2), /expected 0 or 1/);
});

test('checkRetroNeeded passes the exit status through', () => {
  assert.equal(checkRetroNeeded('.', () => ({ status: 1 })), 'skip');
});

test('buildStatusSection fills missing fields with none', () => {
  const s = buildStatusSection({ date: '2026-10-24', goal: 'G' });
  assert.match(s, /### Active goal\n\nG\n/);
  assert.match(s, /### Blockers\n\nnone\n/);
});

test('insertSection lands after the vault pointer block', () => {
  const md = 'a\n<!-- TOOLFORGE-VAULT-POINTER-END -->\n\n## Old\nx\n';
  const out = insertSection(md, buildStatusSection({ date: 'D' }), 'D');
  assert.ok(out.indexOf('## Session wrap (D)') < out.indexOf('## Old'));
});

test('insertSection replaces a same-date section instead of duplicating', () => {
  const first = insertSection('# S\n', buildStatusSection({ date: 'D', goal: 'alpha' }), 'D');
  const second = insertSection(first, buildStatusSection({ date: 'D', goal: 'beta' }), 'D');
  assert.equal(second.match(/## Session wrap \(D\)/g).length, 1);
  assert.match(second, /beta/);
  assert.doesNotMatch(second, /alpha/);
});
