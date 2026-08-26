import assert from 'node:assert/strict';
import test from 'node:test';

import { runWikiQa } from '../runner.mjs';

const BASE_URL = 'https://example.test/wiki';

function passingObservation(url) {
  return {
    url,
    title: 'Architecture Overview',
    text: 'Architecture Overview\nA readable page.',
    domAssertions: [{ role: 'heading', level: 1, text: 'Architecture Overview' }],
    consoleErrors: [],
    failedRequests: [],
    links: [],
    images: [],
    diagrams: [],
    viewport: {
      desktop: { width: 1280, height: 720, overflow: false },
      mobile: { width: 375, height: 812, overflow: false },
    },
  };
}

function createFs() {
  const writes = [];
  return {
    writes,
    async writeFile(path, contents) { writes.push({ path, report: JSON.parse(contents) }); },
  };
}

function createAdapter(openPage) {
  return {
    async checkExecutable() { return { available: true, version: '1.2.3', diagnostics: 'ready' }; },
    openPage,
    async close() {},
  };
}

function dependencies(adapter, fs = createFs(), extra = {}) {
  return {
    adapter,
    fs,
    clock: { now: () => '2026-08-26T12:00:00.000Z', sleep: async () => {} },
    policy: { pages: [] },
    ...extra,
  };
}

test('runs explicitly selected pages once after URL deduplication', async () => {
  const calls = [];
  const fs = createFs();
  const result = await runWikiQa({
    WIKI_QA_BASE_URL: BASE_URL,
    WIKI_QA_PAGES: 'Architecture, Architecture, /Architecture/',
  }, dependencies(createAdapter(async (url) => {
    calls.push(url);
    return passingObservation(url);
  }), fs));

  assert.equal(calls.length, 1);
  assert.deepEqual(result.report.pages.map((page) => page.slug), ['Architecture']);
  assert.equal(result.exitCode, 0);
  assert.equal(fs.writes[0].path, '.artifacts/wiki-qa/report.json');
});

test('discovers deduplicated Wiki links from the index when pages are not explicit', async () => {
  const calls = [];
  const adapter = createAdapter(async (url) => {
    calls.push(url);
    if (url === BASE_URL) {
      return {
        ...passingObservation(url),
        links: [
          { text: 'One', href: `${BASE_URL}/One`, ok: true },
          { text: 'One again', href: `${BASE_URL}/One/`, ok: true },
          { text: 'Outside', href: 'https://example.test/issues', ok: true },
        ],
      };
    }
    return passingObservation(url);
  });

  const result = await runWikiQa({ WIKI_QA_BASE_URL: BASE_URL }, dependencies(adapter));

  assert.deepEqual(calls, [BASE_URL, `${BASE_URL}/One`]);
  assert.deepEqual(result.report.pages.map((page) => page.slug), ['One']);
});

test('fails closed when index discovery yields no auditable pages', async () => {
  const result = await runWikiQa({ WIKI_QA_BASE_URL: BASE_URL }, dependencies(createAdapter(async (url) => passingObservation(url))));

  assert.equal(result.report.partial, true);
  assert.equal(result.report.reason, 'no pages discovered');
  assert.equal(result.exitCode, 1);
});

test('keeps page navigation within the configured conservative concurrency bound', async () => {
  let active = 0;
  let maximum = 0;
  let release;
  const gate = new Promise((resolve) => { release = resolve; });
  const adapter = createAdapter(async (url) => {
    active += 1;
    maximum = Math.max(maximum, active);
    await gate;
    active -= 1;
    return passingObservation(url);
  });
  const run = runWikiQa({
    WIKI_QA_BASE_URL: BASE_URL,
    WIKI_QA_PAGES: 'One,Two,Three',
    WIKI_QA_CONCURRENCY: '2',
  }, dependencies(adapter));

  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(maximum, 2);
  release();
  await run;
  assert.equal(maximum, 2);
});

test('retries transient navigation failures but records the successful final observation', async () => {
  let calls = 0;
  const adapter = createAdapter(async (url) => {
    calls += 1;
    if (calls === 1) {
      const error = new Error('navigation timed out');
      error.kind = 'timeout';
      throw error;
    }
    return passingObservation(url);
  });

  const result = await runWikiQa({ WIKI_QA_BASE_URL: BASE_URL, WIKI_QA_PAGES: 'One' }, dependencies(adapter));

  assert.equal(calls, 2);
  assert.equal(result.report.pages[0].status, 'passed');
  assert.equal(result.report.pages[0].attempts, 2);
});

test('does not retry assertion failures', async () => {
  let calls = 0;
  const adapter = createAdapter(async (url) => {
    calls += 1;
    return { ...passingObservation(url), title: 'one-slug' };
  });

  const result = await runWikiQa({ WIKI_QA_BASE_URL: BASE_URL, WIKI_QA_PAGES: 'One' }, dependencies(adapter));

  assert.equal(calls, 1);
  assert.equal(result.report.pages[0].status, 'failed');
  assert.equal(result.exitCode, 1);
});

test('writes a partial report for pages left unfinished by timeout', async () => {
  const fs = createFs();
  let call = 0;
  const clock = {
    now: () => {
      call += 1;
      return call === 1 ? '2026-08-26T12:00:00.000Z' : '2026-08-26T12:00:01.000Z';
    },
    sleep: async () => {},
  };
  const result = await runWikiQa({
    WIKI_QA_BASE_URL: BASE_URL,
    WIKI_QA_PAGES: 'One,Two',
    WIKI_QA_TIMEOUT_MS: '50',
  }, dependencies(createAdapter(async (url) => passingObservation(url)), fs, { clock }));

  assert.equal(result.report.partial, true);
  assert.equal(result.report.pages.filter((page) => page.status === 'unfinished').length, 2);
  assert.equal(result.exitCode, 1);
  assert.equal(fs.writes.length, 1);
});

test('honors a report-path override and exposes aggregate failure counts', async () => {
  const fs = createFs();
  const result = await runWikiQa({
    WIKI_QA_BASE_URL: BASE_URL,
    WIKI_QA_PAGES: 'One',
    WIKI_QA_REPORT: 'tmp/wiki-report.json',
  }, dependencies(createAdapter(async (url) => ({ ...passingObservation(url), consoleErrors: [{ level: 'error', text: 'boom' }] })), fs));

  assert.equal(fs.writes[0].path, 'tmp/wiki-report.json');
  assert.equal(result.report.aggregate.failed, 1);
  assert.equal(result.report.aggregate.unfinished, 0);
  assert.equal(result.exitCode, 1);
});
