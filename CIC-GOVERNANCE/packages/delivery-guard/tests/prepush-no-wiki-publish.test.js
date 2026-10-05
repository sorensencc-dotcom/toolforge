import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import assert from 'node:assert/strict';

const repositoryRoot = path.resolve(import.meta.dirname, '..', '..', '..', '..');

// A git push must never publish docs. Only `npm run docs:sync` does.
const PUBLISHER_PATTERNS = [
  /sync-github-wiki/,
  /toolforge\.wiki/,
  /wiki:publish/,
  /wiki:sync/,
  /docs:sync/,
  /doc-sync\/run/,
];

function extractPrePushHook(installerSource) {
  const start = installerSource.indexOf('$prePushHook = @"');
  assert.notEqual(start, -1, 'setup-git-hooks.ps1 no longer defines $prePushHook');
  const end = installerSource.indexOf('\n"@', start);
  assert.notEqual(end, -1, 'pre-push here-string is unterminated');
  return installerSource.slice(start, end);
}

test('pre-push hook template does not run any wiki or docs publisher', () => {
  const installer = fs.readFileSync(path.join(repositoryRoot, 'setup-git-hooks.ps1'), 'utf8');
  const hook = extractPrePushHook(installer);
  assert.match(hook, /skill_security_auditor/, 'extraction should capture the real pre-push body');
  for (const pattern of PUBLISHER_PATTERNS) {
    assert.doesNotMatch(hook, pattern, `pre-push hook must not reference ${pattern}`);
  }
});

test('installer logs no wiki sync step for the pre-push hook', () => {
  const installer = fs.readFileSync(path.join(repositoryRoot, 'setup-git-hooks.ps1'), 'utf8');
  const hook = extractPrePushHook(installer);
  assert.doesNotMatch(hook, /Synchronizing .*Wiki/i);
});
