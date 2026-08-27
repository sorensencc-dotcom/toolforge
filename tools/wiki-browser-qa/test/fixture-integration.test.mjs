import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import test from 'node:test';

import { createNeoAdapter } from '../neo-adapter.mjs';
import { runWikiQa } from '../runner.mjs';

const fixtureRoot = path.join(path.dirname(fileURLToPath(import.meta.url)), 'fixtures');
const NEO_MCP_URL = process.env.WIKI_QA_NEO_MCP_URL ?? 'http://127.0.0.1:9010/mcp';

const fixturePolicy = {
  pages: [
    {
      slug: 'passing-page.html',
      requiredDiagrams: [{
        selector: '#fixture-architecture',
        sourceAsset: 'tools/wiki-browser-qa/test/fixtures/assets/architecture.svg',
        assetPattern: 'assets/architecture\\.svg$',
        requireAlt: true,
        requireCaption: true,
        viewports: {
          desktop: { requireVisible: true, allowHorizontalOverflow: false },
          mobile: { requireVisible: true, allowHorizontalOverflow: false },
        },
      }],
    },
    {
      slug: 'failing-page.html',
      requiredDiagrams: [{
        selector: '#fixture-architecture',
        sourceAsset: 'tools/wiki-browser-qa/test/fixtures/assets/architecture.svg',
        assetPattern: 'assets/architecture\\.svg$',
        requireAlt: true,
        requireCaption: true,
        viewports: {
          desktop: { requireVisible: true, allowHorizontalOverflow: false },
          mobile: { requireVisible: true, allowHorizontalOverflow: false },
        },
      }],
    },
  ],
};

async function fixture(name) {
  return readFile(path.join(fixtureRoot, name), 'utf8');
}

function createReportFs() {
  const reports = [];
  return {
    reports,
    async mkdir() {},
    async writeFile(_path, contents) { reports.push(JSON.parse(contents)); },
  };
}

async function serveFixtures(t) {
  const server = createServer(async (request, response) => {
    const pathname = new URL(request.url, 'http://fixture.test').pathname;
    const relative = path.posix.normalize(pathname).replace(/^\/+/, '');
    const filename = path.resolve(fixtureRoot, relative || 'passing-page.html');
    if (!filename.startsWith(`${fixtureRoot}${path.sep}`)) {
      response.writeHead(400).end('invalid fixture path');
      return;
    }
    try {
      const contents = await readFile(filename);
      response.writeHead(200, {
        'content-type': filename.endsWith('.svg') ? 'image/svg+xml' : 'text/html; charset=utf-8',
      }).end(contents);
    } catch {
      response.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' }).end('fixture missing');
    }
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise((resolve) => server.close(resolve)));
  const { port } = server.address();
  return `http://127.0.0.1:${port}`;
}

function failedCheckNames(report) {
  return report.pages[0].checks.filter((check) => !check.passed).map((check) => check.name);
}

// Real BrowserOS Neo backend. This gate must not be silently skipped: if Neo is not reachable
// the audit fails closed and the test reports the exact setup diagnostic.
async function assertNeoLive() {
  const status = await createNeoAdapter({ url: NEO_MCP_URL, timeoutMs: 30_000 }).checkExecutable();
  assert.equal(
    status.available,
    true,
    `BrowserOS Neo real-browser backend is required for this test and is not available.\n${status.diagnostics}`,
  );
}

function neoEnv(baseUrl, page) {
  return {
    WIKI_QA_BROWSER_BACKEND: 'neo',
    WIKI_QA_NEO_MCP_URL: NEO_MCP_URL,
    WIKI_QA_BASE_URL: baseUrl,
    WIKI_QA_PAGES: page,
    WIKI_QA_TIMEOUT_MS: '120000',
  };
}

test('fixture pages encode passing rendering and every required failure mode', async () => {
  const [passing, failing] = await Promise.all([
    fixture('passing-page.html'),
    fixture('failing-page.html'),
    fixture('assets/architecture.svg'),
  ]);

  assert.match(passing, /<h1>Architecture overview<\/h1>/i);
  assert.match(passing, /id="fixture-architecture"/);
  assert.match(passing, /alt="Architecture diagram showing the local Wiki QA flow"/);
  assert.match(passing, /<figcaption>Local Wiki QA architecture<\/figcaption>/);
  assert.match(passing, /<a href="\/passing-page\.html">Verified local fixture link<\/a>/);
  assert.doesNotMatch(passing, /missing-page\.html/);
  assert.match(failing, /^\s*---\s*\n\s*title: Failing page\s*\n\s*layout: wiki\s*\n\s*---\s*$/m);
  assert.match(failing, /<h1>failing-page<\/h1>/);
  assert.match(failing, /<h1>Duplicate heading<\/h1>/);
  assert.match(failing, /src="\/assets\/missing\.svg" alt=""/);
  assert.match(failing, /@media \(max-width: 600px\)/);
  assert.match(failing, /\.wide-content/);
});

test('BrowserOS Neo audit passes the clean rendered fixture on desktop and mobile', async (t) => {
  await assertNeoLive();
  const baseUrl = await serveFixtures(t);
  const fs = createReportFs();
  const result = await runWikiQa(neoEnv(baseUrl, 'passing-page.html'), { fs, policy: fixturePolicy });

  assert.equal(result.report.browser.backend, 'neo');
  assert.equal(result.exitCode, 0, JSON.stringify(result.report, null, 2));
  assert.equal(result.report.pages[0].status, 'passed', JSON.stringify(result.report.pages[0], null, 2));
  assert.deepEqual(result.report.pages[0].diagramEvidence[0].viewports, {
    desktop: { visible: true, overflow: false },
    mobile: { visible: true, overflow: false },
  });
  assert.equal(fs.reports[0].aggregate.passed, 1);
});

test('BrowserOS Neo audit reports malformed metadata, image, diagram, and overflow failures', async (t) => {
  await assertNeoLive();
  const baseUrl = await serveFixtures(t);
  const result = await runWikiQa(neoEnv(baseUrl, 'failing-page.html'), { fs: createReportFs(), policy: fixturePolicy });

  assert.equal(result.report.browser.backend, 'neo');
  assert.equal(result.exitCode, 1);
  assert.equal(result.report.pages[0].status, 'failed');
  assert.deepEqual(failedCheckNames(result.report), [
    'headings',
    'readable-title',
    'hidden-frontmatter',
    'links',
    'console-and-network',
    'images',
    'responsive-overflow',
    'diagram-evidence',
  ], JSON.stringify(result.report, null, 2));
  assert.equal(result.report.pages[0].diagramEvidence[0].viewports.desktop.visible, true);
  assert.equal(result.report.pages[0].diagramEvidence[0].viewports.mobile.visible, false);
});
