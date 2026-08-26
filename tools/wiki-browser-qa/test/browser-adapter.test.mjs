import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createBrowserAdapter, normalizeBrowserObservation } from '../browser-adapter.mjs';

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
      return { stdout: args[0] === 'goto' ? 'Navigated to page\n' : args[0] === 'text' ? 'Page\n' : args[0] === 'viewport' ? `Viewport set to ${args[1]}\n` : args[0] === 'accessibility' ? '(no accessible elements found)\n' : args[0] === 'links' ? '(no links)\n' : args[0] === 'network' ? '(no network requests)\n' : args[0] === 'js' ? JSON.stringify({ images: [], diagrams: [] }) : '(no console errors)\n', stderr: '', status: 0 };
    },
  });

  await adapter.openPage('https://example.test/wiki/Page', { timeoutMs: 2500 });
  assert.deepEqual(calls.map(({ args }) => args[0]), [
    'goto', 'text', 'links', 'console', 'network', 'accessibility', 'viewport', 'js', 'viewport', 'js',
  ]);
  assert.equal(calls.filter(({ args }) => args[0] === 'js').every(({ args }) => /document\.images/.test(args[1])), true);
  assert.equal(calls.some(({ args }) => ['cookie', 'cookie-import', 'cookie-import-browser', 'cookies', 'header'].includes(args[0])), false);
});

test('normalizes documented gstack command output', async () => {
  const adapter = createBrowserAdapter({
    executable: 'fake-browser',
    spawn: async (_command, args) => ({ status: 0, stderr: '', stdout: ({
      goto: 'Navigated to page\n',
      text: 'A Human Page\n',
      links: 'Page → https://example.test/wiki/Page\n',
      console: '[2026-08-26T00:00:00.000Z] [error] bad script\n',
      network: 'GET https://example.test/missing.png → 404 (1ms, 0B)\n',
      accessibility: 'heading "A Human Page" [level=1]\n',
      viewport: `Viewport set to ${args[1]}\n`,
      js: JSON.stringify({
        images: [{ src: 'https://example.test/diagram.svg', alt: 'Architecture diagram', naturalWidth: 900, naturalHeight: 500, complete: true, loaded: true }],
        diagrams: [],
      }),
    })[args[0]] || '' }),
  });

  assert.deepEqual(await adapter.openPage('https://example.test/wiki/Page'), {
    url: 'https://example.test/wiki/Page',
    title: 'A Human Page',
    heading: { level: 1, role: 'heading', text: 'A Human Page' },
    text: 'A Human Page',
    consoleErrors: [{ level: 'error', text: 'bad script' }],
    failedRequests: [{ url: 'https://example.test/missing.png', status: 404, details: '1ms, 0B' }],
    domAssertions: [{ level: 1, role: 'heading', text: 'A Human Page' }],
    accessibility: 'heading "A Human Page" [level=1]',
    viewport: { desktop: { width: 1280, height: 720 }, mobile: { width: 375, height: 812 } },
    images: [{ src: 'https://example.test/diagram.svg', alt: 'Architecture diagram', naturalWidth: 900, naturalHeight: 500, complete: true, loaded: true }],
    links: [{ text: 'Page', href: 'https://example.test/wiki/Page' }],
    diagrams: [],
  });
});

test('collects rendered image and required-diagram evidence at each viewport', async () => {
  const calls = [];
  const adapter = createBrowserAdapter({
    executable: 'fake-browser',
    spawn: async (_command, args) => {
      calls.push(args);
      const output = {
        goto: 'Navigated to page\n',
        text: 'Architecture\n',
        links: '(no links)\n',
        console: '(no console errors)\n',
        network: '(no network requests)\n',
        accessibility: 'heading "Architecture" [level=1]\n',
        viewport: `Viewport set to ${args[1]}\n`,
        js: JSON.stringify({
          images: [{ src: 'https://example.test/assets/architecture.svg', alt: 'Architecture diagram', naturalWidth: 900, naturalHeight: 500, complete: true, loaded: true }],
          diagrams: [{
            selector: '[data-diagram="architecture"]',
            src: 'https://example.test/assets/architecture.svg',
            sourceAsset: 'assets/architecture.svg',
            visible: true,
            loaded: true,
            sourceBacked: true,
            alt: 'Architecture diagram',
            caption: 'Architecture overview',
            fencedAscii: false,
            viewport: { visible: true, overflow: false },
          }],
        }),
      };
      return { status: 0, stderr: '', stdout: output[args[0]] || '' };
    },
  });

  const observation = await adapter.openPage('https://example.test/wiki/Architecture', {
    diagramRules: [{ selector: '[data-diagram="architecture"]', sourceAsset: 'assets/architecture.svg' }],
  });

  assert.equal(observation.images[0].naturalWidth, 900);
  assert.deepEqual(observation.diagrams[0].viewports, {
    desktop: { visible: true, overflow: false },
    mobile: { visible: true, overflow: false },
  });
  assert.equal(calls.filter((args) => args[0] === 'js').length, 2);
});

test('serializes shared browser page audits so observations stay bound to their page', async () => {
  let activeUrl = '';
  const adapter = createBrowserAdapter({
    executable: 'fake-browser',
    spawn: async (_command, args) => {
      if (args[0] === 'goto') {
        activeUrl = args[1];
        return { status: 0, stderr: '', stdout: 'Navigated to page\n' };
      }
      await new Promise((resolve) => setImmediate(resolve));
      const pageName = new URL(activeUrl).pathname.split('/').at(-1);
      const output = {
        text: `Page ${pageName}\n`,
        links: '(no links)\n',
        console: '(no console errors)\n',
        network: '(no network requests)\n',
        accessibility: `heading "Page ${pageName}" [level=1]\n`,
        viewport: `Viewport set to ${args[1]}\n`,
        js: JSON.stringify({ images: [], diagrams: [] }),
      };
      return { status: 0, stderr: '', stdout: output[args[0]] || '' };
    },
  });

  const [one, two] = await Promise.all([
    adapter.openPage('https://example.test/wiki/One'),
    adapter.openPage('https://example.test/wiki/Two'),
  ]);

  assert.equal(one.text, 'Page One');
  assert.equal(two.text, 'Page Two');
});

test('reports missing executable with PowerShell-safe gstack browse diagnostics', async () => {
  const adapter = createBrowserAdapter({
    executable: 'missing-browse',
    spawn: async () => { throw Object.assign(new Error('not found'), { code: 'ENOENT' }); },
  });
  const result = await adapter.checkExecutable();
  assert.equal(result.available, false);
  assert.equal(result.kind, 'setup-failure');
  assert.match(result.diagnostics, /PowerShell command: & "\$env:USERPROFILE\\\.agents\\skills\\gstack\\browse\\dist\\browse\.exe" --help/);
  assert.match(result.diagnostics, /expected layout: \$env:USERPROFILE\\\.agents\\skills\\gstack\\browse\\dist\\browse\.exe; reinstall or rebuild gstack browse if that executable is absent/);
  assert.doesNotMatch(result.diagnostics, /cd \/d|&& setup/i);
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
    spawn: async (_command, args) => ({ status: 0, stdout: args[0] === 'goto' ? 'Navigated\n' : 'not a valid links response\n', stderr: '' }),
  });
  await assert.rejects(
    adapter.openPage('https://example.test/bad-output'),
    (error) => error.kind === 'malformed-output' && /links|output/i.test(error.message),
  );
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
    if (args[0] === 'goto') console.log('Navigated to page');
    if (args[0] === 'text') console.log('Fake Page');
    if (args[0] === 'links') console.log('Home → https://example.test/home');
    if (args[0] === 'console') console.log('(no console errors)');
    if (args[0] === 'network') console.log('(no network requests)');
    if (args[0] === 'accessibility') console.log('heading "Fake Page" [level=1]');
    if (args[0] === 'viewport') console.log('Viewport set to ' + args[1]);
    if (args[0] === 'js') console.log(JSON.stringify({ images: [], diagrams: [] }));
    if (args[0] === 'stop') console.log('[browse] Shutting down...');
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
    spawn: (command, args) => { calls.push(args); return { status: 0, stdout: args[0] === 'goto' ? 'Navigated\n' : args[0] === 'text' ? 'Page\n' : args[0] === 'viewport' ? `Viewport set to ${args[1]}\n` : args[0] === 'accessibility' ? '(no accessible elements found)\n' : args[0] === 'links' ? '(no links)\n' : args[0] === 'network' ? '(no network requests)\n' : args[0] === 'js' ? JSON.stringify({ images: [], diagrams: [] }) : '(no console errors)\n', stderr: '' }; },
  });
  await adapter.openPage('https://example.test/page');
  await adapter.close();
  assert.deepEqual(calls.at(-1), ['stop']);
});

test('serializes close behind the complete openPage collection', async () => {
  const calls = [];
  let releaseText;
  let textStarted;
  const textReady = new Promise((resolve) => { textStarted = resolve; });
  const adapter = createBrowserAdapter({
    executable: 'fake-browser',
    spawn: (command, args) => {
      calls.push(args);
      if (args[0] === 'text') {
        textStarted();
        return new Promise((resolve) => { releaseText = () => resolve({ status: 0, stdout: 'Page\n', stderr: '' }); });
      }
      const output = args[0] === 'goto' ? 'Navigated\n' : args[0] === 'accessibility' ? '(no accessible elements found)\n' : args[0] === 'links' ? '(no links)\n' : args[0] === 'network' ? '(no network requests)\n' : args[0] === 'viewport' ? `Viewport set to ${args[1]}\n` : args[0] === 'js' ? JSON.stringify({ images: [], diagrams: [] }) : '(no console errors)\n';
      return { status: 0, stdout: output, stderr: '' };
    },
  });
  const opening = adapter.openPage('https://example.test/page');
  await textReady;
  const closing = adapter.close();
  await Promise.resolve();
  assert.equal(calls.some((args) => args[0] === 'stop'), false);
  releaseText();
  await opening;
  await closing;
  assert.deepEqual(calls.at(-1), ['stop']);
});

test('fails closed for nested normalized observation shapes', () => {
  const invalid = [
    { links: [{ text: 'home', href: 42 }] },
    { images: [{ src: '/diagram.svg', alt: 'diagram', naturalWidth: '100' }] },
    { diagrams: [{ selector: '.diagram', visible: 'yes', loaded: true, sourceAsset: 'asset.svg' }] },
    { viewport: { desktop: { width: '1280', height: 720, overflow: false } } },
  ];
  for (const value of invalid) assert.throws(() => normalizeBrowserObservation(value, 'https://example.test/page'), (error) => error.kind === 'malformed-output');
});

test('rejects an explicitly empty viewport object', () => {
  assert.throws(
    () => normalizeBrowserObservation({ viewport: {} }, 'https://example.test/page'),
    (error) => error.kind === 'malformed-output',
  );
});

test('keeps heading-less accessibility tree as raw normalized data', async () => {
  const adapter = createBrowserAdapter({
    executable: 'fake-browser',
    spawn: async (_command, args) => ({ status: 0, stderr: '', stdout: ({
      goto: 'Navigated\n', text: 'Body text\n', links: '(no links)\n', console: '(no console errors)\n',
      network: '(no network requests)\n', accessibility: 'paragraph "Body text"\n', viewport: `Viewport set to ${args[1]}\n`,
      js: JSON.stringify({ images: [], diagrams: [] }),
    })[args[0]] }),
  });
  const observation = await adapter.openPage('https://example.test/page');
  assert.equal(observation.heading, null);
  assert.equal(observation.accessibility, 'paragraph "Body text"');
});
