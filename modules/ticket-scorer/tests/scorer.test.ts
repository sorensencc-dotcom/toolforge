import test from 'node:test';
import assert from 'node:assert/strict';
import { DeterministicTicketScorer } from '../src/scorer.js';

test('DeterministicTicketScorer scores complete sample ticket accurately (90 score -> P0)', () => {
  const scorer = new DeterministicTicketScorer();
  const sampleTicket = `
## Problem Description
Regression detected in engine sync pipeline. The ledger worker fails when processing concurrent deposits.

### Repro
\`\`\`bash
npm run test:repro -- --worker=sync
\`\`\`

### Acceptance Criteria
- [ ] Mutex locked on ledger access
- [ ] Regression test added for concurrent ingress
- [ ] Fix leak in event stream handler
`;

  const result = scorer.score(sampleTicket);

  assert.equal(result.totalScore, 90);
  assert.equal(result.tier, 'P0');
  assert.deepEqual(result.breakdown, {
    completeness: 35,
    urgency: 20,
    domainScope: 20,
    actionability: 15,
  });
  assert.ok(result.flags.includes('KEYWORD_REGRESSION'));
  assert.ok(result.flags.includes('KEYWORD_LEAK'));
  assert.ok(result.flags.includes('DOMAIN_ENGINE'));
  assert.ok(result.flags.includes('DOMAIN_SYNC'));
  assert.ok(result.flags.includes('DOMAIN_LEDGER'));
});

test('DeterministicTicketScorer handles empty or minimal tickets with low score and flags', () => {
  const scorer = new DeterministicTicketScorer();
  const result = scorer.score('');

  assert.equal(result.totalScore, 0);
  assert.equal(result.tier, 'P3');
  assert.deepEqual(result.breakdown, {
    completeness: 0,
    urgency: 0,
    domainScope: 0,
    actionability: 0,
  });
  assert.ok(result.flags.includes('LOW_WORD_COUNT'));
  assert.ok(result.flags.includes('MISSING_CHECKLIST_CRITERIA'));
  assert.ok(result.flags.includes('UNRECOGNIZED_DOMAIN'));
});

test('DeterministicTicketScorer applies P0 floor override on panic keyword even with low total score', () => {
  const scorer = new DeterministicTicketScorer();
  const ticket = 'System panic on startup.';
  const result = scorer.score(ticket);

  assert.ok(result.totalScore < 80);
  assert.equal(result.tier, 'P0'); // Floor override applied
  assert.ok(result.flags.includes('KEYWORD_PANIC'));
});

test('DeterministicTicketScorer respects custom constructor options', () => {
  const customScorer = new DeterministicTicketScorer({
    knownDomains: ['billing', 'payments'],
    urgencyKeywords: { outage: 30 },
    overrideP0Keywords: ['outage'],
    minBodyWordCount: 5,
    scoreThresholds: { p0: 95 },
  });

  const ticket = 'Major outage in payments subsystem.';
  const result = customScorer.score(ticket);

  assert.ok(result.flags.includes('DOMAIN_PAYMENTS'));
  assert.ok(result.flags.includes('KEYWORD_OUTAGE'));
  assert.equal(result.tier, 'P0');
});

test('DeterministicTicketScorer matches and scores keywords and domains wrapped in backticks (inlineCode)', () => {
  const scorer = new DeterministicTicketScorer();
  const ticket = `
## Urgent Issue
We observed a \`panic\` when executing the \`sync\` worker under load.

- [ ] Investigate stack trace
- [ ] Add unit test
- [ ] Deploy fix
`;
  const result = scorer.score(ticket);

  assert.ok(result.flags.includes('KEYWORD_PANIC'));
  assert.ok(result.flags.includes('DOMAIN_SYNC'));
  assert.equal(result.tier, 'P0');
});

