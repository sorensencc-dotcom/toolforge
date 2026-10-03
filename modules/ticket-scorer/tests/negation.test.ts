import test from 'node:test';
import assert from 'node:assert/strict';
import { hasAffirmativeMatch, normalizeClause } from '../src/negation-matcher.js';

test('normalizeClause removes parentheticals, quotes, brackets, and extra spaces', () => {
  assert.equal(
    normalizeClause('not (strictly speaking) critical'),
    'not critical'
  );
  assert.equal(
    normalizeClause("not 'in our view' a blocker"),
    'not in our view a blocker'
  );
  assert.equal(
    normalizeClause('tested [no errors] clean'),
    'tested clean'
  );
});

test('hasAffirmativeMatch rejects hyphenated negations', () => {
  assert.equal(hasAffirmativeMatch('This is non-blocking and can wait.', 'blocking'), false);
  assert.equal(hasAffirmativeMatch('Non-critical update needed.', 'critical'), false);
  assert.equal(hasAffirmativeMatch('This is noncritical.', 'critical'), false);
});

test('hasAffirmativeMatch rejects adverbial negations in same clause', () => {
  assert.equal(hasAffirmativeMatch('This is not critical for the milestone.', 'critical'), false);
  assert.equal(hasAffirmativeMatch('There is no leak in the database worker.', 'leak'), false);
  assert.equal(hasAffirmativeMatch("It isn't a regression, just a refactor.", 'regression'), false);
  assert.equal(hasAffirmativeMatch('This is without a blocker, ready to ship.', 'blocker'), false);
  assert.equal(hasAffirmativeMatch('This is not (strictly speaking) critical.', 'critical'), false);
  assert.equal(hasAffirmativeMatch("Service is not 'critically' blocked.", 'blocked'), false);
  assert.equal(hasAffirmativeMatch('There is no `leak` in memory allocation.', 'leak'), false);
});

test('hasAffirmativeMatch preserves clause boundaries across punctuation', () => {
  assert.equal(hasAffirmativeMatch('Did not run. Critical error occurred.', 'critical'), true);
  assert.equal(hasAffirmativeMatch('Nothing broken;\nblocking issue identified in sync.', 'blocking'), true);
  assert.equal(hasAffirmativeMatch('No issues in staging! Urgent fix needed in prod.', 'urgent'), true);
  assert.equal(hasAffirmativeMatch('Did not repro? Panic observed on rerun.', 'panic'), true);
  assert.equal(hasAffirmativeMatch('Did not test\nCritical crash during boot', 'critical'), true);
  assert.equal(hasAffirmativeMatch('Did not finish (phase 1). Critical failure on boot.', 'critical'), true);
});

test('hasAffirmativeMatch recognizes genuine affirmatives', () => {
  assert.equal(hasAffirmativeMatch('This is critical: database deadlocks on ingress.', 'critical'), true);
  assert.equal(hasAffirmativeMatch('Observed a memory leak in sync worker.', 'leak'), true);
  assert.equal(hasAffirmativeMatch('Not ideal, but critical issue needs triage.', 'critical'), true);
  assert.equal(hasAffirmativeMatch('Identified a (very) critical issue.', 'critical'), true);
});
