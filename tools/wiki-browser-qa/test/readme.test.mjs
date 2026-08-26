import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import test from 'node:test';

const readmePath = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'README.md');

test('README documents browser setup, local mirror usage, report contract, and safe execution boundaries', async () => {
  const readme = await readFile(readmePath, 'utf8');

  assert.match(readme, /GSTACK_BROWSER_EXECUTABLE/);
  assert.match(readme, /browse\.exe/i);
  assert.match(readme, /GSTACK_BROWSER_EXECUTABLE --help/);
  assert.match(readme, /WIKI_QA_BASE_URL/);
  assert.match(readme, /WIKI_QA_PAGES/);
  assert.match(readme, /WIKI_QA_REPORT/);
  assert.match(readme, /WIKI_QA_CONCURRENCY/);
  assert.match(readme, /WIKI_QA_TIMEOUT_MS/);
  assert.match(readme, /local (?:static )?mirror|loopback fixture/i);
  assert.match(readme, /target.*timestamp.*pages.*aggregate/is);
  assert.match(readme, /no credentials|never.*credentials/i);
  assert.match(readme, /cookies/i);
  assert.match(readme, /live.*separate|separate.*live/i);
  assert.match(readme, /upload-artifact@v7/);
  assert.match(readme, /if: failure\(\)/);
});
