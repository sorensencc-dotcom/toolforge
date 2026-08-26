import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createBrowserAdapter } from '../browser-adapter.mjs';

const nodeExecutable = process.execPath;

async function fakeExecutable(source) {
  const directory = await mkdtemp(join(tmpdir(), 'wiki-browser-qa-'));
  const script = join(directory, 'fake-browser.mjs');
  await writeFile(script, source, 'utf8');
  return { executable: nodeExecutable, args: [script], directory };
}

test('constructs safe gstack command for page navigation', async () => {
  const calls = [];
  const adapter = createBrowserAdapter({
    executable: 'browse.exe',
    spawn: (command, args) => {
      calls.push({ command, args });
      return { stdout: JSON.stringify({ title: 'Page', heading: { level: 1, text: 'Page' } }), stderr: '', status: 0 };
    },
  });

  await adapter.openPage('https://example.test/wiki/Page', { timeoutMs: 2500 });
  assert.deepEqual(calls, [{ command: 'browse.exe', args: ['goto', 'https://example.test/wiki/Page'] }]);
  assert.equal(calls[0].args.some((arg) => /cookie|header|token|password/i.test(arg)), false);
});

test('normalizes JSON-line browser response', async () => {
  const adapter = createBrowserAdapter({
    executable: 'fake-browser',
    spawn: async () => ({
      status: 0,
      stdout: JSON.stringify({
        url: 'https://example.test/wiki/Page',
        title: 'A Human Page',
        heading: { level: 1, text: 'A Human Page' },
        console: [{ level: 'error', text: 'bad script' }],
        network: [{ url: 'https://example.test/missing.png', status: 404 }],
        dom: [{ selector: 'h1', passed: true }],
        viewport: { desktop: { width: 1280, overflow: false }, mobile: { width: 375, overflow: false } },
      }) + '\n',
      stderr: '',
    }),
  });

  assert.deepEqual(await adapter.openPage('https://example.test/wiki/Page'), {
    url: 'https://example.test/wiki/Page',
    title: 'A Human Page',
    heading: { level: 1, text: 'A Human Page' },
    consoleErrors: [{ level: 'error', text: 'bad script' }],
    failedRequests: [{ url: 'https://example.test/missing.png', status: 404 }],
    domAssertions: [{ selector: 'h1', passed: true }],
    viewport: { desktop: { width: 1280, overflow: false }, mobile: { width: 375, overflow: false } },
    images: [],
    links: [],
  });
});

test('reports missing executable with setup command and detected version diagnostics', async () => {
  const adapter = createBrowserAdapter({
    executable: 'missing-browse',
    setupCommand: 'cd ~/.agents/skills/gstack/browse && ./setup',
    spawn: async () => { throw Object.assign(new Error('not found'), { code: 'ENOENT' }); },
  });
  const result = await adapter.checkExecutable();
  assert.equal(result.available, false);
  assert.equal(result.kind, 'missing-executable');
  assert.match(result.diagnostics, /cd .*&& \.\/setup/);
  assert.match(result.diagnostics, /version: unavailable/i);
});

test('classifies setup and version failures', async () => {
  const adapter = createBrowserAdapter({
    executable: 'browse.exe',
    spawn: async () => ({ status: 1, stdout: 'gstack browse 1.2.3\n', stderr: 'Chromium setup required\n' }),
  });
  const result = await adapter.checkExecutable();
  assert.equal(result.available, false);
  assert.equal(result.kind, 'setup-failure');
  assert.equal(result.version, '1.2.3');
  assert.match(result.diagnostics, /Chromium setup required/);
});

test('classifies subprocess timeout', async () => {
  const adapter = createBrowserAdapter({
    executable: 'fake-browser',
    spawn: () => new Promise(() => {}),
  });
  await assert.rejects(
    adapter.openPage('https://example.test/slow', { timeoutMs: 10 }),
    (error) => error.kind === 'timeout' && /timed out/i.test(error.message),
  );
});

test('classifies malformed JSON-line output', async () => {
  const adapter = createBrowserAdapter({
    executable: 'fake-browser',
    spawn: async () => ({ status: 0, stdout: '{not-json}\n', stderr: '' }),
  });
  await assert.rejects(
    adapter.openPage('https://example.test/bad-output'),
    (error) => error.kind === 'malformed-output' && /JSON/i.test(error.message),
  );
});

test('interacts with a fake executable and closes it', async () => {
  const fake = await fakeExecutable(`
    const args = process.argv.slice(2);
    if (args[0] === '--help') { console.log('gstack browse 9.9.9'); process.exit(0); }
    if (args[0] === 'goto') console.log(JSON.stringify({ url: args[1], title: 'Fake Page', heading: { level: 1, text: 'Fake Page' } }));
  `);
  const adapter = createBrowserAdapter({ executable: fake.executable, executableArgs: fake.args });
  try {
    const health = await adapter.checkExecutable();
    assert.equal(health.available, true);
    assert.equal(health.version, '9.9.9');
    const observation = await adapter.openPage('https://example.test/fake');
    assert.equal(observation.title, 'Fake Page');
    assert.equal(observation.url, 'https://example.test/fake');
  } finally {
    await adapter.close();
    await rm(fake.directory, { recursive: true, force: true });
  }
});
