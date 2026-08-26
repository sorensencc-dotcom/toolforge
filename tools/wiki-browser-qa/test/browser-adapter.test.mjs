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
      return { stdout: JSON.stringify({}), stderr: '', status: 0 };
    },
  });

  await adapter.openPage('https://example.test/wiki/Page', { timeoutMs: 2500 });
  assert.deepEqual(calls.map(({ args }) => args), [
    ['goto', 'https://example.test/wiki/Page'], ['text'], ['links'], ['console', '--errors'],
    ['network'], ['accessibility'], ['viewport', '1280x720'], ['viewport', '375x812'],
  ]);
  assert.equal(calls.flatMap(({ args }) => args).some((arg) => /cookie|header|token|password/i.test(arg)), false);
});

test('normalizes JSON-line browser response', async () => {
  const adapter = createBrowserAdapter({
    executable: 'fake-browser',
    spawn: async (_command, args) => ({ status: 0, stderr: '', stdout: JSON.stringify({
      ...(args[0] === 'goto' ? { url: 'https://example.test/wiki/Page' } : {}),
      ...(args[0] === 'text' ? { title: 'A Human Page', heading: { level: 1, text: 'A Human Page' }, text: 'A Human Page' } : {}),
      ...(args[0] === 'console' ? { consoleErrors: [{ level: 'error', text: 'bad script' }] } : {}),
      ...(args[0] === 'network' ? { failedRequests: [{ url: 'https://example.test/missing.png', status: 404 }] } : {}),
      ...(args[0] === 'accessibility' ? { domAssertions: [{ selector: 'h1', passed: true }] } : {}),
      ...(args[0] === 'viewport' ? { viewport: { width: Number(args[1].split('x')[0]), overflow: false } } : {}),
      links: args[0] === 'links' ? [{ text: 'Page', href: '/wiki/Page' }] : undefined,
    }) + '\n' }),
  });

  assert.deepEqual(await adapter.openPage('https://example.test/wiki/Page'), {
    url: 'https://example.test/wiki/Page',
    title: 'A Human Page',
    heading: { level: 1, text: 'A Human Page' },
    text: 'A Human Page',
    consoleErrors: [{ level: 'error', text: 'bad script' }],
    failedRequests: [{ url: 'https://example.test/missing.png', status: 404 }],
    domAssertions: [{ selector: 'h1', passed: true }],
    viewport: { desktop: { width: 1280, overflow: false }, mobile: { width: 375, overflow: false } },
    images: [],
    links: [{ text: 'Page', href: '/wiki/Page' }],
});
});

test('reports missing executable with setup command and detected version diagnostics', async () => {
  const adapter = createBrowserAdapter({
    executable: 'missing-browse',
    spawn: async () => { throw Object.assign(new Error('not found'), { code: 'ENOENT' }); },
  });
  const result = await adapter.checkExecutable();
  assert.equal(result.available, false);
  assert.equal(result.kind, 'setup-failure');
  assert.match(result.diagnostics, /cd \/d "%USERPROFILE%\\\.agents\\skills\\gstack\\browse" && setup/);
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

test('classifies asynchronous missing executable as setup failure', async () => {
  const adapter = createBrowserAdapter({
    executable: 'missing-browse',
    spawn: async () => { throw Object.assign(new Error('not found'), { code: 'ENOENT' }); },
  });
  await assert.rejects(adapter.openPage('https://example.test/page'), (error) => error.kind === 'setup-failure');
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

test('fails closed when a response field has the wrong shape', async () => {
  const adapter = createBrowserAdapter({
    executable: 'fake-browser',
    spawn: async (_command, args) => ({
      status: 0, stderr: '', stdout: JSON.stringify(args[0] === 'text' ? { title: 42 } : {}) + '\n',
    }),
  });
  await assert.rejects(adapter.openPage('https://example.test/bad-shape'), (error) => error.kind === 'malformed-output');
});

test('rejects URL credentials without exposing URL in error', async () => {
  const calls = [];
  const adapter = createBrowserAdapter({ executable: 'fake-browser', spawn: (command, args) => { calls.push(args); return { status: 0, stdout: '{}\n', stderr: '' }; } });
  const credentialUrl = ['https://', 'user', ':', 'secret', '@example.test/wiki/Page'].join('');
  await assert.rejects(adapter.openPage(credentialUrl), (error) => {
    assert.equal(error.kind, 'invalid-url');
    assert.doesNotMatch(error.message, /secret|user|example\.test/);
    return true;
  });
  assert.deepEqual(calls, []);
});

test('interacts with a fake executable and closes it', async () => {
  const fake = await fakeExecutable(`
    const args = process.argv.slice(2);
    if (args[0] === '--help') { console.log('gstack browse 9.9.9'); process.exit(0); }
    if (args[0] === 'goto') console.log(JSON.stringify({ url: args[1] }));
    if (args[0] === 'text') console.log(JSON.stringify({ title: 'Fake Page', heading: { level: 1, text: 'Fake Page' }, text: 'Fake Page' }));
    if (['links', 'console', 'network', 'accessibility', 'viewport'].includes(args[0])) console.log(JSON.stringify({}));
    if (args[0] === 'stop') console.log(JSON.stringify({ stopped: true }));
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

test('stops persistent browser on close', async () => {
  const calls = [];
  const adapter = createBrowserAdapter({
    executable: 'fake-browser',
    spawn: (command, args) => { calls.push(args); return { status: 0, stdout: '{}\n', stderr: '' }; },
  });
  await adapter.openPage('https://example.test/page');
  await adapter.close();
  assert.deepEqual(calls.at(-1), ['stop']);
});
