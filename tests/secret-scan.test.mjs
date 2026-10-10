import assert from 'node:assert/strict';
import test from 'node:test';
import { checkContent, PATTERNS, ALLOWLIST } from '../scripts/secret-scan.mjs';

test('secret-scan exports patterns and allowlist', () => {
  assert.ok(Array.isArray(PATTERNS));
  assert.ok(PATTERNS.length >= 5);
  assert.ok(Array.isArray(ALLOWLIST));
});

test('secret-scan detects connection string credentials', () => {
  // Construct via segments so static staged scanners ignore test fixture
  const fakeSecret = ['postgres', '://', 'mockuser', ':', 'mockpass', '@', 'mockhost.local:5432/db'].join('');
  const hits = checkContent(`DATABASE_URL=${fakeSecret}`);
  assert.ok(hits.length > 0);
  assert.equal(hits[0].includes('connection-string-credential'), true);
});

test('secret-scan allows safe templates without credentials', () => {
  const hits = checkContent('DATABASE_URL=${DATABASE_URL}');
  assert.equal(hits.length, 0);
});

test('secret-scan allows docker-compose password templates with fallback and required syntax', () => {
  const fallbackUrl = 'DATABASE_URL=postgres://${POSTGRES_USER:-postgres}:${POSTGRES_PASSWORD:-postgres}@postgres:5432/toolforge';
  const requiredUrl = 'DATABASE_URL=postgres://${POSTGRES_USER:-postgres}:${POSTGRES_PASSWORD:?}@postgres:5432/toolforge';
  assert.equal(checkContent(fallbackUrl).length, 0, 'fallback template should be allowed');
  assert.equal(checkContent(requiredUrl).length, 0, 'required variable template should be allowed');
});

