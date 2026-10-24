import test from 'node:test';
import assert from 'node:assert/strict';
import { parseStatus, formatBrief, runPreflight, loadBrief } from '../src/index.mjs';

const MD = `# Status
## Old
### Active goal
stale
## Retro (2026-10-19)
### Active goal
Ship retro gate
### Completed work
- one
- two
### Next
Open PR
`;

test('parseStatus takes the latest section and defaults to none', () => {
  const s = parseStatus(MD);
  assert.equal(s['Active goal'], 'Ship retro gate');
  assert.equal(s['Completed work'], '- one\n- two');
  assert.equal(s['Next action'], 'Open PR');
  assert.equal(s.Blockers, 'none');
});

test('formatBrief flattens multi-line values', () => {
  const out = formatBrief({ root: 'C:\\r', branch: 'main', status: parseStatus(MD) });
  assert.match(out, /^PREFLIGHT: PASS {2}C:\\r {2}main/);
  assert.match(out, /Completed work: - one - two/);
});

test('runPreflight reports the first error line on failure', () => {
  const exec = () => { const e = new Error('x'); e.stderr = 'Repository path must be absolute\nstack'; throw e; };
  assert.deepEqual(runPreflight('rel', exec), { pass: false, error: 'Repository path must be absolute' });
});

test('loadBrief stops before reading STATUS.md when preflight fails', () => {
  const exec = () => { throw new Error('Not a Git repository'); };
  const r = loadBrief('C:\\nope', { exec });
  assert.equal(r.pass, false);
  assert.match(r.text, /^PREFLIGHT: FAIL/);
});
