// tests/doc-sync-registry.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateRegistry } from '../scripts/doc-sync/registry.mjs';

const base = {
  name: 'trm', repoPath: 'C:\\dev\\trm', remote: 'https://github.com/sorensencc-dotcom/TRM.wiki.git',
  sourceDir: 'wiki', enabled: true,
};

test('accepts a valid sourceDir product and defaults ingest to true', () => {
  const [p] = validateRegistry({ products: [base] });
  assert.equal(p.name, 'trm');
  assert.equal(p.ingest, true);
});

test('accepts a buildCommand product that uses {out}', () => {
  const [p] = validateRegistry({ products: [{ ...base, sourceDir: undefined, buildCommand: 'node build.mjs --out "{out}"', ingest: false }] });
  assert.equal(p.ingest, false);
});

test('requires exactly one of sourceDir and buildCommand', () => {
  assert.throws(() => validateRegistry({ products: [{ ...base, sourceDir: undefined }] }), /REGISTRY_INVALID: trm: set exactly one of sourceDir or buildCommand/);
  assert.throws(() => validateRegistry({ products: [{ ...base, buildCommand: 'x {out}' }] }), /REGISTRY_INVALID: trm: set exactly one of sourceDir or buildCommand/);
});

test('buildCommand must contain {out}', () => {
  assert.throws(() => validateRegistry({ products: [{ ...base, sourceDir: undefined, buildCommand: 'node build.mjs' }] }), /REGISTRY_INVALID: trm: buildCommand must contain \{out\}/);
});

test('rejects a duplicate remote', () => {
  assert.throws(() => validateRegistry({ products: [base, { ...base, name: 'trm2' }] }), /REGISTRY_INVALID: duplicate remote/);
});

test('rejects a duplicate name', () => {
  assert.throws(() => validateRegistry({ products: [base, { ...base, remote: 'git@github.com:sorensencc-dotcom/x.wiki.git' }] }), /REGISTRY_INVALID: duplicate name/);
});

test('rejects a remote that is not a sorensencc-dotcom wiki', () => {
  assert.throws(() => validateRegistry({ products: [{ ...base, remote: 'https://github.com/someone/TRM.wiki.git' }] }), /REGISTRY_INVALID: remote/);
  assert.throws(() => validateRegistry({ products: [{ ...base, remote: 'https://github.com/sorensencc-dotcom/TRM.git' }] }), /REGISTRY_INVALID: remote/);
});

test('rejects quarantine, disallowed, escaping, and absolute source folders', () => {
  assert.throws(() => validateRegistry({ products: [{ ...base, repoPath: 'C:\\dev', sourceDir: 'wiki' }] }), /REGISTRY_INVALID: sourceDir/);
  assert.throws(() => validateRegistry({ products: [{ ...base, repoPath: 'C:\\dev\\x', sourceDir: '..\\wiki' }] }), /REGISTRY_INVALID: sourceDir/);
  for (const bad of ['_kb-sync-staging/x', 'dev-sandbox/a', '.claude/worktrees/b', 'NODE_MODULES/c', '..', '../other', 'C:\\elsewhere', '.']) {
    assert.throws(() => validateRegistry({ products: [{ ...base, sourceDir: bad }] }), /REGISTRY_INVALID: sourceDir/, bad);
  }
});

test('rejects a repoPath that is relative or inside a disallowed folder', () => {
  assert.throws(() => validateRegistry({ products: [{ ...base, repoPath: 'trm' }] }), /REGISTRY_INVALID: trm: repoPath/);
  assert.throws(() => validateRegistry({ products: [{ ...base, repoPath: 'C:\\dev\\dev-sandbox\\trm' }] }), /REGISTRY_INVALID: trm: repoPath/);
});

test('rejects a name with shell or path characters', () => {
  assert.throws(() => validateRegistry({ products: [{ ...base, name: 'trm"; rm -rf /' }] }), /REGISTRY_INVALID: name/);
});

test('treats SSH and HTTPS forms of one wiki as a duplicate', () => {
  assert.throws(
    () => validateRegistry({ products: [base, { ...base, name: 'trm2', remote: 'git@github.com:sorensencc-dotcom/TRM.wiki.git' }] }),
    /REGISTRY_INVALID: duplicate remote/,
  );
});

test('wraps bad rows and bad JSON in REGISTRY_INVALID', () => {
  assert.throws(() => validateRegistry({ products: [null] }), /REGISTRY_INVALID/);
  assert.throws(() => validateRegistry({ products: [{ ...base, sourceDir: 42 }] }), /REGISTRY_INVALID/);
});
