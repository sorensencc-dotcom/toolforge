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
    'data/dataset.bin': 'binary',
    'src/payload.bin': 'binary'
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
    assert.match(result.data.ingestionDigest.summary, /^2 files extracted \| 6 files pruned/);
    assert.match(result.data.ingestionDigest.content, /src\/core\/models\.py/);
    assert.match(result.data.ingestionDigest.content, /src\/api\/server\.py/);
    assert.equal(result.data.ingestionDigest.content.includes('test_placeholder'), false);
    assert.equal(result.data.ingestionDigest.content.includes('long form'), false);
    const reasons = new Map(result.data.ingestionDigest.pruned.map((item) => [item.path, item.reason]));
    assert.equal(reasons.get('docs/architecture.md'), 'docs/*');
    assert.equal(reasons.get('tests/test_api.py'), 'tests/*');
    assert.equal(reasons.get('package-lock.json'), 'package-lock.json');
    assert.equal(reasons.get('data'), 'outside include');
    assert.equal(reasons.get('src/payload.bin'), '*.bin');
    assert.equal(reasons.get('src/api/huge.py'), 'size');
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('kb-sync contract returns diagram and ingest URLs and keeps the TRM modules', () => {
  const remote = triageAndDigest({
    repositoryUrl: 'https://github.com/sorensencc-dotcom/kb-sync',
    targetModules: ['modules/trm/*', 'core/*'],
    excludePatterns: 'tests/*,docs/*,*.lock,*.png,*.html',
    maxFileSizeKb: 50,
    authToken: 'ghp_secret_do_not_leak'
  });
  assert.equal(remote.status, 'success');
  assert.equal(remote.tool, 'triage_and_digest');
  assert.equal(remote.data.pipeline, 'GitDiagram-to-Gitingest');
  assert.equal(remote.data.repository, 'https://github.com/sorensencc-dotcom/kb-sync');
  assert.equal(remote.data.visualArchitecture.interactiveDiagramUrl, 'https://gitdiagram.com/sorensencc-dotcom/kb-sync');
  assert.equal(remote.data.visualArchitecture.explainerVideoUrl, 'https://gitdiagram.com/sorensencc-dotcom/kb-sync/videos');
  assert.equal(remote.data.ingestionDigest.content, null);
  assert.match(remote.data.ingestionDigest.ingestUrl, /^https:\/\/gitingest\.com\/sorensencc-dotcom\/kb-sync\?/);
  assert.match(remote.data.ingestionDigest.ingestUrl, /include=modules/);
  assert.deepEqual(remote.telemetry.capabilitiesVerified, ['repo:read', 'repo:visualize', 'repo:ingest']);
  assert.equal(JSON.stringify(remote).includes('ghp_secret_do_not_leak'), false);

  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'kb-sync-trm-'));
  try {
    const files = {
      'modules/trm/query-expander.mjs': 'export function expand() { return ["gap"]; }\n',
      'modules/trm/ast-grounding.mjs': 'export function ground() { return []; }\n',
      'modules/trm/gap-triage-engine.mjs': 'export function triage() { return { tier: 1 }; }\n',
      'core/config.mjs': 'export const name = "kb-sync";\n',
      'tests/gap.test.mjs': 'throw new Error("fixture");\n',
      'docs/guide.md': '# guide\n',
      'package-lock.json': '{}\n',
      'node_modules/left-pad/index.js': 'module.exports = "LEAK_MODULE";\n'
    };
    for (const [relative, content] of Object.entries(files)) {
      const absolute = path.join(root, relative);
      fs.mkdirSync(path.dirname(absolute), { recursive: true });
      fs.writeFileSync(absolute, content);
    }
    const local = triageAndDigest({
      repositoryUrl: 'https://github.com/sorensencc-dotcom/kb-sync',
      targetModules: ['modules/trm/*', 'core/*'],
      excludePatterns: 'tests/*,docs/*,*.lock,*.png,*.html',
      maxFileSizeKb: 50,
      localRoot: root,
      authToken: 'ghp_secret_do_not_leak'
    });
    const content = local.data.ingestionDigest.content;
    assert.match(content, /modules\/trm\/query-expander\.mjs/);
    assert.match(content, /modules\/trm\/ast-grounding\.mjs/);
    assert.match(content, /modules\/trm\/gap-triage-engine\.mjs/);
    assert.match(content, /core\/config\.mjs/);
    assert.equal(content.includes('LEAK_MODULE'), false);
    assert.equal(content.includes('fixture'), false);
    const reasons = new Map(local.data.ingestionDigest.pruned.map((item) => [item.path, item.reason]));
    assert.equal(reasons.get('node_modules'), 'skipped directory');
    assert.equal(reasons.get('tests/gap.test.mjs'), 'tests/*');
    assert.equal(reasons.get('docs/guide.md'), 'docs/*');
    assert.equal(JSON.stringify(local).includes('ghp_secret_do_not_leak'), false);
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
