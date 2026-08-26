import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const toolRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const policyPath = path.join(toolRoot, 'diagram-policy.json');

const classifiedPages = [
  'toolforge-architecture-overview',
  'OLLAMA_PROVIDER_SETUP',
  'OLLAMA_DEPLOYMENT_GUIDE',
  'whichllm-model-selection-evaluator',
  'GOVERNANCE',
];

function loadPolicy() {
  return JSON.parse(fs.readFileSync(policyPath, 'utf8'));
}

function validatePolicy(policy, pages = classifiedPages) {
  const entries = new Map(policy.pages.map((page) => [page.slug, page]));
  const missingPages = pages.filter((slug) => !entries.has(slug));
  assert.deepEqual(missingPages, [], 'every classified architecture/provider page must be listed');

  for (const page of policy.pages) {
    assert.match(page.slug, /^[A-Za-z0-9][A-Za-z0-9_-]*$/);
    assert.ok(page.categories.length > 0);
    assert.ok(page.sourcePage, `${page.slug} needs an exact source page`);
    assert.equal(fs.existsSync(path.resolve(toolRoot, '..', '..', page.sourcePage)), true, `${page.slug} source page does not resolve: ${page.sourcePage}`);
    assert.ok(Array.isArray(page.acceptedSelectors));
    assert.ok(Array.isArray(page.acceptedAssetPatterns));
    assert.ok(page.requirements);
    assert.equal(page.requirements.requireAlt, true);
    assert.equal(page.requirements.requireCaption, true);
    assert.ok(page.viewports.desktop);
    assert.ok(page.viewports.mobile);
    assert.equal(page.viewports.desktop.requireVisible, true);
    assert.equal(page.viewports.mobile.requireVisible, true);
    assert.equal(page.viewports.desktop.allowHorizontalOverflow, false);
    assert.equal(page.viewports.mobile.allowHorizontalOverflow, false);

    for (const mapping of page.sourceMappings) {
      const resolved = path.resolve(toolRoot, '..', '..', mapping.repositoryPath);
      assert.equal(fs.existsSync(resolved), true, `${page.slug} mapping does not resolve: ${mapping.repositoryPath}`);
      assert.ok(['source-asset', 'generated-artifact'].includes(mapping.kind));
    }
  }
}

test('policy rejects an unlisted classified page', () => {
  assert.throws(
    () => validatePolicy({ pages: [{ slug: 'toolforge-architecture-overview' }] }, classifiedPages),
    /every classified architecture\/provider page must be listed/,
  );
});

test('policy rejects a nonexistent source mapping', () => {
  assert.throws(
    () => validatePolicy({
      pages: [{
        slug: 'toolforge-architecture-overview',
        categories: ['architecture'],
        sourcePage: 'wiki/toolforge-architecture-overview.html',
        acceptedSelectors: ['img'],
        acceptedAssetPatterns: ['toolforge'],
        requirements: { requireAlt: true, requireCaption: true },
        viewports: {
          desktop: { requireVisible: true, allowHorizontalOverflow: false },
          mobile: { requireVisible: true, allowHorizontalOverflow: false },
        },
        sourceMappings: [{ kind: 'source-asset', repositoryPath: 'wiki/missing.png' }],
      }],
    }, ['toolforge-architecture-overview']),
    /mapping does not resolve: wiki\/missing\.png/,
  );
});

test('approved policy covers classified pages and resolves every source mapping', () => {
  validatePolicy(loadPolicy());
});
