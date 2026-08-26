import test from 'node:test';
import assert from 'node:assert/strict';

import {
  checkConsoleAndNetwork,
  checkDiagramEvidence,
  checkHeadings,
  checkHiddenFrontmatter,
  checkImages,
  checkLinks,
  checkPageObservation,
  checkReadableTitle,
  checkResponsiveOverflow,
} from '../checks.mjs';

const passingObservation = {
  title: 'Architecture',
  headings: [{ level: 1, text: 'Architecture' }],
  bodyText: 'System architecture and data flow.',
  links: [{ href: '/wiki/Architecture', status: 200, inScope: true }],
  consoleErrors: [],
  failedRequests: [],
  images: [{ src: '/assets/architecture.svg', alt: 'Architecture diagram', naturalWidth: 900, naturalHeight: 500, complete: true }],
  viewports: [
    { name: 'desktop', scrollWidth: 1200, clientWidth: 1200 },
    { name: 'mobile', scrollWidth: 390, clientWidth: 390 },
  ],
  diagrams: [{
    selector: '[data-diagram="architecture"]',
    visible: true,
    loaded: true,
    src: '/assets/architecture.svg',
    sourceAsset: 'assets/architecture.svg',
    alt: 'Architecture diagram',
    caption: 'Architecture overview',
    sourceBacked: true,
    fencedAscii: false,
  }],
};

const architecturePolicy = {
  requiredDiagrams: [{
    selector: '[data-diagram="architecture"]',
    sourceAsset: 'assets/architecture.svg',
    requireAlt: true,
    requireCaption: true,
  }],
};

test('checkHeadings accepts one meaningful H1 and rejects duplicates or missing H1', () => {
  assert.equal(checkHeadings(passingObservation.headings).passed, true);
  assert.equal(checkHeadings([{ level: 1, text: 'One' }, { level: 1, text: 'Two' }]).passed, false);
  assert.equal(checkHeadings([{ level: 2, text: 'Only subheading' }]).passed, false);
  assert.equal(checkHeadings([{ level: 1, text: '   ' }]).passed, false);
});

test('checkReadableTitle requires human-readable title and visible H1 instead of a slug', () => {
  assert.equal(checkReadableTitle('Architecture', passingObservation.headings).passed, true);
  assert.equal(checkReadableTitle('architecture-system', [{ level: 1, text: 'architecture-system' }]).passed, false);
  assert.equal(checkReadableTitle('https://example.test/wiki/Architecture', passingObservation.headings).passed, false);
});

test('checkHiddenFrontmatter rejects YAML delimiters and keys exposed in rendered body', () => {
  assert.equal(checkHiddenFrontmatter(passingObservation.bodyText).passed, true);
  assert.equal(checkHiddenFrontmatter('---\ntitle: Architecture\n---\nArchitecture').passed, false);
  assert.equal(checkHiddenFrontmatter('Architecture\nsidebar_label: Architecture').passed, false);
});

test('checkLinks rejects invalid in-scope links while ignoring external links', () => {
  assert.equal(checkLinks(passingObservation.links).passed, true);
  assert.equal(checkLinks([{ href: '/wiki/Missing', status: 404, inScope: true }]).passed, false);
  assert.equal(checkLinks([{ href: '/wiki/Unknown', inScope: true }]).passed, false);
  assert.equal(checkLinks([{ href: '/wiki/Unknown', ok: false, inScope: true }]).passed, false);
  assert.equal(checkLinks([{ href: '/wiki/Unknown', status: 0, inScope: true }]).passed, false);
  assert.equal(checkLinks([{ href: 'https://external.test', status: 500, inScope: false }]).passed, true);
});

test('checkConsoleAndNetwork reports console and failed network requests', () => {
  assert.equal(checkConsoleAndNetwork(passingObservation).passed, true);
  const result = checkConsoleAndNetwork({ consoleErrors: ['TypeError'], failedRequests: [{ url: '/asset.svg', status: 404 }] });
  assert.equal(result.passed, false);
  assert.match(result.details, /console/i);
  assert.match(result.details, /network|request/i);
});

test('checkImages rejects broken images, empty alt text, and zero natural dimensions', () => {
  assert.equal(checkImages(passingObservation.images).passed, true);
  assert.equal(checkImages([{ src: '/broken.svg', alt: 'Diagram', naturalWidth: 0, naturalHeight: 0, complete: false }]).passed, false);
  assert.equal(checkImages([{ src: '/unknown.svg', alt: 'Diagram', complete: true }]).passed, false);
  assert.equal(checkImages([{ src: '/negative.svg', alt: 'Diagram', naturalWidth: -1, naturalHeight: 10, complete: true }]).passed, false);
  assert.equal(checkImages([{ src: '/no-alt.svg', alt: ' ', naturalWidth: 10, naturalHeight: 10, complete: true }]).passed, false);
});

test('checkResponsiveOverflow rejects unexpected horizontal overflow on supported viewports', () => {
  assert.equal(checkResponsiveOverflow(passingObservation.viewports).passed, true);
  assert.equal(checkResponsiveOverflow([{ name: 'mobile', scrollWidth: 500, clientWidth: 390 }]).passed, false);
});

test('checkDiagramEvidence requires visible loaded source-backed diagram with alt and caption', () => {
  assert.equal(checkDiagramEvidence(passingObservation.diagrams, architecturePolicy).passed, true);
  assert.equal(checkDiagramEvidence([{ ...passingObservation.diagrams[0], visible: false }], architecturePolicy).passed, false);
  assert.equal(checkDiagramEvidence([{ ...passingObservation.diagrams[0], sourceBacked: false }], architecturePolicy).passed, false);
  assert.equal(checkDiagramEvidence([{ ...passingObservation.diagrams[0], src: '/assets/other.svg', sourceAsset: 'assets/other.svg', sourceBacked: true }], architecturePolicy).passed, false);
  assert.equal(checkDiagramEvidence([{ ...passingObservation.diagrams[0], alt: '' }], architecturePolicy).passed, false);
  assert.equal(checkDiagramEvidence([{ ...passingObservation.diagrams[0], caption: '' }], architecturePolicy).passed, false);
  assert.equal(checkDiagramEvidence([{ selector: '.ascii', visible: true, loaded: true, fencedAscii: true }], {
    requiredDiagrams: [{ selector: '.ascii', sourceAsset: 'assets/ascii.svg' }],
  }).passed, false);
});

test('checkPageObservation returns serializable named results for every page assertion', () => {
  const results = checkPageObservation(passingObservation, architecturePolicy);
  assert.ok(Array.isArray(results));
  assert.deepEqual(results.map(({ name }) => name), [
    'headings',
    'readable-title',
    'hidden-frontmatter',
    'links',
    'console-and-network',
    'images',
    'responsive-overflow',
    'diagram-evidence',
  ]);
  assert.ok(results.every((result) => Object.keys(result).sort().join(',') === 'details,name,passed'));
  assert.doesNotThrow(() => JSON.stringify(results));
  assert.equal(results.every(({ passed }) => passed), true);
});
