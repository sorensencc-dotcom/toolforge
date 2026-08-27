import assert from 'node:assert/strict';
import test from 'node:test';

import { BACKENDS, createBackendAdapter, resolveBackendName } from '../backend.mjs';
import { createNeoAdapter } from '../neo-adapter.mjs';
import { checkPageObservation } from '../checks.mjs';

function neoRunReturn(value) {
  return { content: [{ type: 'text', text: `ok\nreturn: ${JSON.stringify(value)}` }], isError: false };
}

function viewportEvidence(width) {
  return {
    images: [{ src: 'http://127.0.0.1:9999/assets/architecture.svg', alt: 'Architecture diagram', naturalWidth: 640, naturalHeight: 280, complete: true, loaded: true }],
    links: [{ text: 'Home', href: 'http://127.0.0.1:9999/Home', inScope: true, ok: true, status: 200 }],
    diagrams: [{
      selector: '#fixture-architecture',
      src: 'http://127.0.0.1:9999/assets/architecture.svg',
      sourceAsset: 'assets/architecture.svg',
      visible: true,
      loaded: true,
      sourceBacked: true,
      alt: 'Architecture diagram',
      caption: 'System architecture',
      fencedAscii: false,
      viewport: { visible: true, overflow: false },
    }],
    viewport: { scrollWidth: width, clientWidth: width, overflow: false },
  };
}

function fakeTransport(overrides = {}) {
  const calls = [];
  const base = {
    calls,
    async listTools() {
      return { tools: [{ name: 'run' }, { name: 'navigate' }, { name: 'evaluate' }, { name: 'snapshot' }] };
    },
    async callTool(name, args) {
      calls.push({ name, args });
      if (name === 'run' && typeof args.code === 'string' && args.code.includes('wiki-qa-neo-live')) {
        return { content: [{ type: 'text', text: 'ok\nreturn: "wiki-qa-neo-live"' }], isError: false };
      }
      return neoRunReturn(base.pageEnvelope);
    },
    serverInfo() {
      return { name: 'browseros-neo', version: '0.0.44' };
    },
    async close() {},
    pageEnvelope: {
      ok: true,
      url: 'http://127.0.0.1:9999/Home',
      console: [],
      meta: {
        title: 'Architecture Overview',
        text: 'Architecture Overview\nReadable body copy.',
        headings: [{ role: 'heading', level: 1, text: 'Architecture Overview' }],
        heading: { level: 1, text: 'Architecture Overview' },
        failedRequests: [],
      },
      viewports: [
        { name: 'desktop', width: 1280, height: 720, evidence: viewportEvidence(1280) },
        { name: 'mobile', width: 375, height: 812, evidence: viewportEvidence(375) },
      ],
    },
  };
  return Object.assign(base, overrides);
}

test('resolveBackendName defaults to gstack and rejects unknown backends', () => {
  assert.equal(resolveBackendName({}), 'gstack');
  assert.equal(resolveBackendName({ WIKI_QA_BROWSER_BACKEND: 'NEO' }), 'neo');
  assert.deepEqual(BACKENDS, ['gstack', 'neo']);
  assert.throws(() => resolveBackendName({ WIKI_QA_BROWSER_BACKEND: 'playwright' }), /must be one of gstack, neo/);
});

test('createBackendAdapter returns the gstack adapter by default', () => {
  const adapter = createBackendAdapter({}, { timeoutMs: 1000 });
  assert.equal(adapter.backend, 'gstack');
  for (const method of ['checkExecutable', 'openPage', 'close']) assert.equal(typeof adapter[method], 'function');
});

test('createBackendAdapter returns a Neo adapter when the backend is selected', () => {
  const adapter = createBackendAdapter({ WIKI_QA_BROWSER_BACKEND: 'neo', WIKI_QA_NEO_MCP_URL: 'http://127.0.0.1:9010/mcp' }, {});
  assert.equal(adapter.backend, 'neo');
  assert.equal(adapter.url, 'http://127.0.0.1:9010/mcp');
  for (const method of ['checkExecutable', 'openPage', 'close']) assert.equal(typeof adapter[method], 'function');
});

test('Neo checkExecutable reports healthy when the MCP session and run tool respond', async () => {
  const transport = fakeTransport();
  const adapter = createNeoAdapter({ url: 'http://neo.test/mcp', transport });
  const status = await adapter.checkExecutable();
  assert.equal(status.available, true);
  assert.equal(status.version, '0.0.44');
  assert.match(status.diagnostics, /BrowserOS neo MCP healthy/);
});

test('Neo checkExecutable fails closed with a setup diagnostic when the browser session is not connected', async () => {
  const transport = fakeTransport({
    async callTool() {
      return { content: [{ type: 'text', text: 'browser session not connected' }], isError: true };
    },
  });
  const adapter = createNeoAdapter({ url: 'http://neo.test/mcp', transport });
  const status = await adapter.checkExecutable();
  assert.equal(status.available, false);
  assert.equal(status.kind, 'setup-failure');
  assert.match(status.diagnostics, /BrowserOS neo browser session is not connected/);
  assert.match(status.diagnostics, /Start BrowserOS neo/);
});

test('Neo checkExecutable fails closed when the MCP endpoint is unreachable', async () => {
  const transport = fakeTransport({
    async listTools() {
      throw Object.assign(new Error('connect ECONNREFUSED 127.0.0.1:9010'), { kind: 'setup-failure' });
    },
  });
  const adapter = createNeoAdapter({ url: 'http://127.0.0.1:9010/mcp', transport });
  const status = await adapter.checkExecutable();
  assert.equal(status.available, false);
  assert.equal(status.kind, 'setup-failure');
  assert.match(status.diagnostics, /unavailable at http:\/\/127\.0\.0\.1:9010\/mcp/);
});

test('Neo openPage drives a real-browser run script and normalizes the observation', async () => {
  const transport = fakeTransport();
  const adapter = createNeoAdapter({ url: 'http://neo.test/mcp', transport });
  const observation = await adapter.openPage('http://127.0.0.1:9999/Home', {
    timeoutMs: 60_000,
    diagramRules: [{ selector: '#fixture-architecture', sourceAsset: 'assets/architecture.svg' }],
  });

  const runCall = transport.calls.find((call) => call.name === 'run');
  assert.ok(runCall, 'expected a run tool call');
  assert.match(runCall.args.code, /127\.0\.0\.1:9999\/Home/);
  assert.match(runCall.args.code, /Emulation\.setDeviceMetricsOverride/);
  assert.match(runCall.args.code, /browser\.pages\.newPage/);

  assert.equal(observation.title, 'Architecture Overview');
  assert.equal(observation.diagrams[0].viewports.mobile.visible, true);
  assert.deepEqual(observation.viewport.desktop, { width: 1280, height: 720, scrollWidth: 1280, clientWidth: 1280, overflow: false });

  const checks = checkPageObservation({
    ...observation,
    headings: observation.domAssertions,
    bodyText: observation.text,
    viewports: Object.entries(observation.viewport).map(([name, value]) => ({ name, ...value })),
  }, { requiredDiagrams: [{
    selector: '#fixture-architecture',
    sourceAsset: 'assets/architecture.svg',
    requireAlt: true,
    requireCaption: true,
    viewports: { desktop: { requireVisible: true }, mobile: { requireVisible: true } },
  }] });
  assert.deepEqual(checks.filter((check) => !check.passed).map((check) => check.name), []);
});

test('Neo openPage surfaces an in-script failure as a transient navigation error', async () => {
  const transport = fakeTransport({
    async callTool(name) {
      if (name === 'run') return neoRunReturn({ __error: 'navigation failed: net::ERR_CONNECTION_REFUSED', __kind: 'navigation-failure' });
      return { content: [], isError: false };
    },
  });
  const adapter = createNeoAdapter({ url: 'http://neo.test/mcp', transport });
  await assert.rejects(
    adapter.openPage('http://127.0.0.1:9999/Home'),
    (error) => error.kind === 'navigation-failure' && error.transient === true && /ERR_CONNECTION_REFUSED/.test(error.message),
  );
});

test('Neo openPage rejects credentialed URLs without contacting the browser', async () => {
  const transport = fakeTransport();
  const adapter = createNeoAdapter({ url: 'http://neo.test/mcp', transport });
  await assert.rejects(
    adapter.openPage(['http://', 'user', ':', 'secret', '@127.0.0.1:9999/Home'].join('')),
    (error) => error.kind === 'invalid-url' && !/secret/.test(error.message),
  );
  assert.deepEqual(transport.calls, []);
});
