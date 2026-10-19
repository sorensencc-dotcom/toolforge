import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  buildTweetable,
  computeSessions,
  computeStreak,
  countActiveDays,
  countPrReferences,
  isSourceFile,
  topDirectories
} from '../scripts/retro-metrics.mjs';

const minute = 60000;
const at = m => Date.UTC(2026, 9, 18, 0, 0) + m * minute;

test('countActiveDays counts distinct days', () => {
  assert.equal(countActiveDays(['2026-10-12', '2026-10-12', '2026-10-14']), 2);
  assert.equal(countActiveDays([]), 0);
});

test('computeStreak counts consecutive days back from the anchor', () => {
  const days = ['2026-10-18', '2026-10-17', '2026-10-16', '2026-10-14'];
  assert.equal(computeStreak(days, '2026-10-18'), 3);
  assert.equal(computeStreak(days, '2026-10-15'), 0);
  assert.equal(computeStreak([], '2026-10-18'), 0);
});

test('countPrReferences counts unique PR numbers across subjects', () => {
  assert.equal(countPrReferences(['fix: a (#12)', 'Merge pull request #13', 'revert (#12)', 'no ref']), 2);
});

test('topDirectories ranks top-level directories and breaks ties by name', () => {
  const files = ['scripts/a.mjs', 'scripts/b.mjs', 'tests/a.mjs', 'docs/x.md', 'README.md'];
  assert.deepEqual(topDirectories(files, 2), ['scripts/', './']);
  assert.deepEqual(topDirectories(['README.md']), ['./']);
  assert.deepEqual(topDirectories([]), []);
});

test('computeSessions splits commit clusters at the gap and classifies by duration', () => {
  const times = [
    at(0), at(100),
    at(300), at(310),
    at(600),
    at(900), at(960)
  ];
  assert.deepEqual(computeSessions(times), {
    sessions: 4,
    deep: 1,
    medium: 1,
    micro: 2,
    totalMinutes: 170,
    avgMinutes: 43
  });
});

test('computeSessions returns zeros with no commits', () => {
  assert.deepEqual(computeSessions([]), { sessions: 0, deep: 0, medium: 0, micro: 0, totalMinutes: 0, avgMinutes: 0 });
});

test('isSourceFile accepts code extensions only', () => {
  assert.equal(isSourceFile('scripts/a.mjs'), true);
  assert.equal(isSourceFile('docs/a.md'), false);
});

test('buildTweetable states real figures', () => {
  assert.equal(
    buildTweetable({ date: '2026-10-18', commits: 91, versionRange: ['2.92.1', '2.98.1'], testFiles: 336 }),
    'Week ending 2026-10-18: 91 commits, releases 2.92.1 to 2.98.1, 336 test files tracked.'
  );
  assert.match(buildTweetable({ date: 'd', commits: 1, versionRange: ['2.0.0', '2.0.0'], testFiles: 0 }), /version 2\.0\.0/);
});

test('compile script carries no known fabricated constants', () => {
  const content = readFileSync(resolve('scripts/compile-weekly-retro.mjs'), 'utf8');
  for (const bad of [/4800/, /\|\|\s*192/, /\|\|\s*14\b/, /\|\|\s*18\b/, /\|\|\s*8\b/, /streak_days:\s*7/, /active_days:\s*6/, /\* 0\.65/, /Ironbot/]) {
    assert.doesNotMatch(content, bad);
  }
});
