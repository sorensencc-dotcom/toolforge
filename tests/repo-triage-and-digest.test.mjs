import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import {
  callTool,
  gitdiagramTriage,
  gitingestDigest,
  handleMcpMessage,
  normalizeGithubUrl,
  triageAndDigest
} from '../skills/repo-triage-and-digest/src/pipeline.mjs';

function writeFixture(root) {
  const files = {
    'src/api/server.py': "from src.core.models import SkillItem\n\ndef get_skills():\n    return [SkillItem('triage').name]\n",
    'src/core/models.py': 'class SkillItem:\n    def __init__(self, name: str):\n        self.name = name\n',
    'tests/test_api.py': 'def test_placeholder():\n    assert True\n',
    'docs/architecture.md': '# long form\n',
    'package-lock.json': '{}\n',
    'data/dataset.bin': 'binary'
  };
  for (const [relative, content] of Object.entries(files)) {
    const absolute = path.join(root, relative);
    fs.mkdirSync(path.dirname(absolute), { recursive: true });
    fs.writeFileSync(absolute, content);
  }
  fs.writeFileSync(path.join(root, 'src/api/huge.py'), 'x'.repeat(51 * 1024));
}

test('normalizeGithubUrl accepts owner/repo and rejects other hosts', () => {
  assert.equal(normalizeGithubUrl('sorensencc-dotcom/toolforge'), 'https://github.com/sorensencc-dotcom/toolforge');
  assert.equal(
    normalizeGithubUrl('https://github.com/sorensencc-dotcom/toolforge.git'),
    'https://github.com/sorensencc-dotcom/toolforge'
  );
  assert.throws(() => normalizeGithubUrl('https://gitlab.com/acme/service'), /github\.com/);
});

test('gitdiagram and gitingest URLs use the public host swap', () => {
  const triage = gitdiagramTriage('https://github.com/sorensencc-dotcom/toolforge');
  assert.equal(triage.interactiveDiagramUrl, 'https://gitdiagram.com/sorensencc-dotcom/toolforge');
  assert.equal(triage.explainerVideoUrl, 'https://gitdiagram.com/sorensencc-dotcom/toolforge/videos');
  const digest = gitingestDigest({
    repositoryUrl: 'https://github.com/sorensencc-dotcom/toolforge',
    includePatterns: 'skills/*,manifest.json'
  });
  assert.match(digest.data.ingestUrl, /^https:\/\/gitingest\.com\/sorensencc-dotcom\/toolforge\?/);
  assert.match(digest.data.ingestUrl, /include=skills/);
  assert.equal(digest.data.content, null);
});

test('local sample catalog keeps src and prunes tests, docs, lockfiles, binaries, and oversized files', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'service-catalog-'));
  try {
    writeFixture(root);
    const result = triageAndDigest({
      repositoryUrl: 'acme-org/service-catalog',
      localRoot: root,
      targetModules: ['src/*'],
      authToken: 'ghp_secret_do_not_leak'
    });
    assert.equal(JSON.stringify(result).includes('ghp_secret_do_not_leak'), false);
    assert.equal(result.data.ingestionDigest.security.credentialsDiscarded, true);
    assert.match(result.data.ingestionDigest.summary, /^2 files extracted \| 5 files pruned/);
    assert.match(result.data.ingestionDigest.content, /src\/core\/models\.py/);
    assert.match(result.data.ingestionDigest.content, /src\/api\/server\.py/);
    assert.equal(result.data.ingestionDigest.content.includes('test_placeholder'), false);
    assert.equal(result.data.ingestionDigest.content.includes('long form'), false);
    const reasons = new Map(result.data.ingestionDigest.pruned.map((item) => [item.path, item.reason]));
    assert.equal(reasons.get('docs/architecture.md'), 'docs/*');
    assert.equal(reasons.get('tests/test_api.py'), 'tests/*');
    assert.equal(reasons.get('package-lock.json'), 'package-lock.json');
    assert.equal(reasons.get('data/dataset.bin'), '*.bin');
    assert.equal(reasons.get('src/api/huge.py'), 'size');
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('MCP lists the three tools and calls triage without returning a token', () => {
  const listed = handleMcpMessage({ jsonrpc: '2.0', id: 1, method: 'tools/list' });
  assert.deepEqual(listed.result.tools.map((tool) => tool.name), [
    'gitdiagram_triage',
    'gitingest_digest',
    'triage_and_digest'
  ]);
  const called = callTool('gitdiagram_triage', {
    repositoryUrl: 'https://github.com/sorensencc-dotcom/toolforge',
    mode: 'video',
    authToken: 'ghp_secret_do_not_leak'
  });
  assert.equal(called.data.selectedUrl, 'https://gitdiagram.com/sorensencc-dotcom/toolforge/videos');
  assert.equal(JSON.stringify(called).includes('ghp_secret_do_not_leak'), false);
  const missing = handleMcpMessage({ jsonrpc: '2.0', id: 2, method: 'tools/call', params: { name: 'missing', arguments: {} } });
  assert.equal(missing.result.isError, true);
});
