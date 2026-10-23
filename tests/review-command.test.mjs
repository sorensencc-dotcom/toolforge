import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { reviewAction } from '../src/cli/commands/review.js';

const git = (args) => (args[0] === 'diff' ? 'diff --git a/x b/x\n+x\n' : 'feat: x\n\nCo-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>\n----\n');
const pass = { route: { provider: 'openai', model: 'gpt-6.1-sol' }, outcome: { findings: [], noise: [], suppressed: [], flags: [], pass: true } };
const quiet = () => {};

describe('toolforge review --adversarial', () => {
  it('exits 0 on pass and sends the diff and commit message to the reviewer', async () => {
    const seen = [];
    const code = await reviewAction(
      { adversarial: true, base: 'origin/main' },
      { git, log: quiet, error: quiet, review: async (input) => (seen.push(input), pass) },
    );
    assert.equal(code, 0);
    assert.match(seen[0].diff, /\+x/);
    assert.match(seen[0].packet.commitMessage, /Claude Opus 5\.5/);
  });

  it('exits 1 when a finding blocks', async () => {
    const blocked = { ...pass, outcome: { ...pass.outcome, pass: false } };
    const code = await reviewAction({ adversarial: true, base: 'origin/main' }, { git, log: quiet, error: quiet, review: async () => blocked });
    assert.equal(code, 1);
  });

  it('exits 2 and never passes when review throws', async () => {
    const errors = [];
    const code = await reviewAction(
      { adversarial: true, base: 'origin/main' },
      { git, log: quiet, error: (m) => errors.push(m), review: async () => { throw new Error('Missing OPENAI_API_KEY for secondary reviewer in dispatch matrix'); } },
    );
    assert.equal(code, 2);
    assert.match(errors[0], /failed closed.*Missing OPENAI_API_KEY/);
  });

  it('exits 2 without the flag', async () => {
    assert.equal(await reviewAction({ adversarial: false, base: 'origin/main' }, { git, log: quiet, error: quiet }), 2);
  });

  it('exits 2 on an empty diff', async () => {
    assert.equal(await reviewAction({ adversarial: true, base: 'origin/main' }, { git: () => '', log: quiet, error: quiet }), 2);
  });
});
