import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, writeFile, rm } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const root = new URL('../../../', import.meta.url);
const project = 'bhezixgmkhpndmezgsxk';

test('linked Supabase test project passes transaction-scoped database checks', { timeout: 55000 }, async () => {
  assert.equal((await readFile(new URL('supabase/.temp/project-ref', root), 'utf8')).trim(), project);
  const schema = await readFile(new URL('../sql/001-research-store.sql', import.meta.url), 'utf8');
  const assertions = await readFile(new URL('live-assertions.sql', import.meta.url), 'utf8');
  const unsafe = schema.replace('LANGUAGE plpgsql STABLE SECURITY INVOKER', 'LANGUAGE plpgsql STABLE SECURITY DEFINER');
  assert.notEqual(unsafe, schema, 'negative control must change search security mode');
  for (const [index, migration] of [unsafe, schema].entries()) {
    const relativeFile = `skills/research-store/tests/.live-${process.pid}-${index}.sql`;
    const file = new URL(relativeFile, root);
    const sql = `BEGIN;\nSET LOCAL statement_timeout = '15s';\nCREATE SCHEMA research_store_test_124;\nSET LOCAL search_path = research_store_test_124, extensions, public;\n${migration}\n${assertions}\nROLLBACK;\nSELECT to_regnamespace('research_store_test_124') IS NULL AS cleaned_up;\n`;
    try {
      await writeFile(file, sql, { flag: 'wx' });
      const result = spawnSync('C:\\Program Files\\Git\\bin\\bash.exe', ['-lc',
        `timeout 50s npx --yes supabase db query --linked --project-ref ${project} --file ${relativeFile}`], {
        cwd: fileURLToPath(root), encoding: 'utf8', timeout: 52000, maxBuffer: 1024 * 1024,
      });
      assert.ifError(result.error);
      if (index === 0) {
        assert.equal(result.status, 1, 'negative control must reject definer search');
        assert.match(result.stdout + result.stderr, /Test failed: search without project filter/);
        console.log('Negative control detected SECURITY DEFINER cross-project leak.');
      } else {
        assert.equal(result.status, 0, result.stdout + result.stderr);
        const response = JSON.parse(result.stdout);
        assert.ok(response.rows.some(row => row.cleaned_up === true), 'transaction did not confirm schema cleanup');
        console.log('33 linked Supabase SQL assertions passed; temporary schema rolled back.');
      }
    } finally {
      await rm(file, { force: true });
    }
  }
});
