import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { CLASSIFIED_WIKI_PAGES } from '../wiki-page-rules.mjs';

const toolRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const policyPath = path.join(toolRoot, 'diagram-policy.json');

const classifiedPages = CLASSIFIED_WIKI_PAGES.map(({ slug }) => slug);

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
      assert.ok(['source-page', 'source-asset', 'generated-artifact'].includes(mapping.kind));
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

test('approved policy requires real nested diagram evidence for every classified page', () => {
  const policy = loadPolicy();
  const entries = new Map(policy.pages.map((page) => [page.slug, page]));
  assert.equal(new Set(policy.pages.map((page) => page.slug)).size, policy.pages.length, 'policy must not contain duplicate slugs');

  for (const rule of CLASSIFIED_WIKI_PAGES) {
    const page = entries.get(rule.slug);
    assert.ok(page, `${rule.slug} must be covered from authoritative publication rules`);
    assert.equal(page.sourcePage, rule.sourcePage, `${rule.slug} must use its published source page`);
    assert.ok(page.requiredDiagrams.length > 0, `${rule.slug} must require diagram evidence`);

    for (const expected of rule.requiredDiagrams) {
      const diagram = page.requiredDiagrams.find((candidate) => candidate.sourceAsset === expected.sourceAsset);
      assert.ok(diagram, `${rule.slug} must map required source asset ${expected.sourceAsset}`);
      assert.equal(diagram.selector, expected.selector, `${rule.slug} must use the published artifact selector`);
      assert.equal(diagram.assetPattern, expected.assetPattern, `${rule.slug} must use the published artifact pattern`);
      assert.equal(diagram.requireAlt, true, `${rule.slug} must require alternative text`);
      assert.equal(diagram.requireCaption, true, `${rule.slug} must require a caption or explanatory heading`);
      assert.deepEqual(diagram.viewports, {
        desktop: { requireVisible: true, allowHorizontalOverflow: false },
        mobile: { requireVisible: true, allowHorizontalOverflow: false },
      }, `${rule.slug} must require desktop and mobile visible, non-overflowing diagram evidence`);
      assert.equal(fs.existsSync(path.resolve(toolRoot, '..', '..', diagram.sourceAsset)), true,
        `${rule.slug} must map to a real repository asset`);
      assert.match(expected.publishedAssetPath, new RegExp(diagram.assetPattern),
        `${rule.slug} asset pattern must match its actual published artifact`);
      const sourceText = fs.readFileSync(path.resolve(toolRoot, '..', '..', page.sourcePage), 'utf8');
      if (diagram.sourceAsset === page.sourcePage) {
        assert.match(sourceText, /<svg[^>]+aria-label=/,
          `${rule.slug} inline SVG artifact must expose meaningful alternative text`);
        assert.match(sourceText, /class="diagram-caption"/,
          `${rule.slug} inline SVG artifact must include a nearby caption`);
      } else {
        assert.ok(sourceText.includes(expected.publishedAssetPath),
          `${rule.slug} source page must embed its actual published diagram asset`);
      }
    }

    assert.deepEqual(page.acceptedSelectors, page.requiredDiagrams.map(({ selector }) => selector),
      `${rule.slug} legacy selectors must match nested requiredDiagrams`);
    assert.deepEqual(page.acceptedAssetPatterns, page.requiredDiagrams.map(({ assetPattern }) => assetPattern),
      `${rule.slug} legacy patterns must match nested requiredDiagrams`);
    assert.ok(page.sourceMappings.some(({ repositoryPath }) => repositoryPath === page.sourcePage),
      `${rule.slug} sourceMappings must validate the published page source`);
    for (const diagram of page.requiredDiagrams) {
      assert.ok(page.sourceMappings.some(({ repositoryPath }) => repositoryPath === diagram.sourceAsset),
        `${rule.slug} sourceMappings must validate nested source asset ${diagram.sourceAsset}`);
    }
  }
});
