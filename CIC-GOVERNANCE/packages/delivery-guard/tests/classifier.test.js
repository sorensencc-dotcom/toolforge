import test from 'node:test';
import assert from 'node:assert/strict';

import { classifyDiff } from '../src/classifier.js';
import { classifyDiff as publicClassifyDiff } from '@cic/delivery-guard';

const adapter = {
  generatedPaths: ['.ijfw/**', 'dist/**'],
  automationPaths: ['.github/workflows/**', 'scripts/**'],
};

test('classifies authored-only changes and returns exact authored paths', () => {
  const result = classifyDiff([
    { path: 'src/index.js', status: 'modified' },
    { path: 'README.md', status: 'added' },
  ], adapter);

  assert.equal(result.classification, 'authored-only');
  assert.deepEqual(result.authoredPaths, ['README.md', 'src/index.js']);
  assert.deepEqual(result.generatedPaths, []);
  assert.equal(result.decision, 'allow');
});

test('classifies generated-only changes and allows explicit generated intent', () => {
  const result = classifyDiff([
    { path: 'dist/app.js', status: 'modified' },
    { path: '.ijfw/index.md', status: 'untracked' },
  ], adapter, { generatedIntent: true });

  assert.equal(result.classification, 'generated-only');
  assert.deepEqual(result.authoredPaths, []);
  assert.deepEqual(result.generatedPaths, ['.ijfw/index.md', 'dist/app.js']);
  assert.equal(result.decision, 'allow');
});

test('requires explicit generated intent for generated-only changes', () => {
  const result = classifyDiff([{ path: 'dist/app.js', status: 'modified' }], adapter);

  assert.equal(result.classification, 'generated-only');
  assert.equal(result.decision, 'block');
  assert.deepEqual(result.issues, ['generated-intent-required']);
});

test('classifies mixed changes with exact authored and generated paths', () => {
  const result = classifyDiff([
    { path: 'scripts/build.mjs', status: 'modified' },
    { path: 'src/index.js', status: 'modified' },
    { path: 'dist/app.js', status: 'added' },
  ], adapter, { generatedIntent: true });

  assert.equal(result.classification, 'mixed');
  assert.deepEqual(result.authoredPaths, ['scripts/build.mjs', 'src/index.js']);
  assert.deepEqual(result.generatedPaths, ['dist/app.js']);
  assert.equal(result.decision, 'warn');
  assert.deepEqual(result.issues, ['mixed-authored-generated']);
});

test('classifies deleted paths by their repository-relative path', () => {
  const result = classifyDiff([
    { path: 'dist/old.js', status: 'deleted' },
    { path: 'src/old.js', status: 'deleted' },
  ], adapter, { generatedIntent: true });

  assert.equal(result.classification, 'mixed');
  assert.deepEqual(result.authoredPaths, ['src/old.js']);
  assert.deepEqual(result.generatedPaths, ['dist/old.js']);
});

test('classifies renamed paths using both old and new exact paths', () => {
  const result = classifyDiff([
    { path: 'src/new.js', oldPath: 'dist/old.js', status: 'renamed' },
  ], adapter, { generatedIntent: true });

  assert.equal(result.classification, 'mixed');
  assert.deepEqual(result.authoredPaths, ['src/new.js']);
  assert.deepEqual(result.generatedPaths, ['dist/old.js']);
  assert.deepEqual(result.paths, ['dist/old.js', 'src/new.js']);
});

test('classifies untracked paths without requiring a Git status code', () => {
  const result = classifyDiff(['new-file.txt'], adapter);

  assert.equal(result.classification, 'authored-only');
  assert.deepEqual(result.authoredPaths, ['new-file.txt']);
  assert.deepEqual(result.paths, ['new-file.txt']);
});

test('rejects malformed diff entries with a stable issue', () => {
  assert.throws(
    () => classifyDiff([{ status: 'modified' }], adapter),
    /Invalid delivery-guard diff entry/,
  );
});

test('normalizes Windows separators in changed paths and configured patterns', () => {
  const result = classifyDiff([
    { path: 'dist\\nested\\app.js', status: 'modified' },
  ], { generatedPaths: ['dist\\**\\*.js'] }, { generatedIntent: true });

  assert.equal(result.classification, 'generated-only');
  assert.deepEqual(result.generatedPaths, ['dist/nested/app.js']);
});

test('applies segment-aware glob semantics', () => {
  const result = classifyDiff([
    { path: 'dist/app.js', status: 'modified' },
    { path: 'dist/nested/app.js', status: 'modified' },
    { path: 'dist/app.test.js', status: 'modified' },
    { path: 'dist/app.jsx', status: 'modified' },
  ], { generatedPaths: ['dist/**/*.js'] }, { generatedIntent: true });

  assert.equal(result.classification, 'mixed');
  assert.deepEqual(result.generatedPaths, ['dist/app.js', 'dist/app.test.js', 'dist/nested/app.js']);
  assert.deepEqual(result.authoredPaths, ['dist/app.jsx']);
});

for (const pattern of ['dist/[ab].js', 'dist/{app,test}.js', 'dist/!(app).js']) {
  test(`rejects unsupported glob syntax: ${pattern}`, () => {
    assert.throws(
      () => classifyDiff([{ path: 'dist/app.js' }], { generatedPaths: [pattern] }),
      (error) => error.name === 'UnsupportedGlobError'
        && error.pattern === pattern,
    );
  });
}

test('exports classifier through package public API', () => {
  const result = publicClassifyDiff(
    [{ path: 'dist/app.js' }],
    { generatedPaths: ['dist/**'] },
    { generatedIntent: true },
  );

  assert.equal(result.classification, 'generated-only');
});