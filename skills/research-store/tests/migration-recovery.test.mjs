import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, writeFile, rm } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const root = new URL('../../../', import.meta.url);
const project = 'bhezixgmkhpndmezgsxk';

test('enhancement migration rehearsal rolls back synthetic failure and leaves no fixture schema', { timeout: 100000 }, async () => {
  assert.equal((await readFile(new URL('supabase/.temp/project-ref', root), 'utf8')).trim(), project);
  const schema = await readFile(new URL('../sql/001-research-store.sql', import.meta.url), 'utf8');
  const fixture = `research_store_recovery_${process.pid}`;
  const rerun = `${fixture}_rerun`;
  const relativeFile = `skills/research-store/tests/.recovery-${process.pid}.sql`;
  const file = new URL(relativeFile, root);
  const sql = `BEGIN;
SET LOCAL statement_timeout = '15s';
CREATE SCHEMA ${fixture};
SET LOCAL search_path = ${fixture}, extensions, public;
${schema}
INSERT INTO documents(project, git_path, title, source_type, content_hash)
VALUES ('CIC', 'recovery/cic.md', 'Recovery CIC', 'archive', 'hash');
DO $$
BEGIN
  BEGIN
    ALTER TABLE ${fixture}.documents ADD COLUMN failed_enhancement text;
    RAISE EXCEPTION 'synthetic enhancement failure';
  EXCEPTION WHEN others THEN
    NULL;
  END;
END $$;
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = '${fixture}' AND table_name = 'documents' AND column_name = 'failed_enhancement'
  ) THEN
    RAISE EXCEPTION 'failed enhancement was not rolled back';
  END IF;
END $$;
ALTER TABLE documents ADD COLUMN rehearsal_tag text;
CREATE INDEX documents_rehearsal_tag_idx ON documents(rehearsal_tag);
UPDATE documents SET rehearsal_tag = 'ok' WHERE git_path = 'recovery/cic.md';
DO $$
BEGIN
  IF (SELECT rehearsal_tag FROM documents WHERE git_path = 'recovery/cic.md') <> 'ok' THEN
    RAISE EXCEPTION 'successful enhancement did not apply';
  END IF;
END $$;
DROP SCHEMA ${fixture} CASCADE;
CREATE SCHEMA ${rerun};
SET LOCAL search_path = ${rerun}, extensions, public;
${schema}
DROP SCHEMA ${rerun} CASCADE;
ROLLBACK;
SELECT to_regnamespace('${fixture}') IS NULL AS fixture_cleaned,
       to_regnamespace('${rerun}') IS NULL AS rerun_cleaned;
`;
  try {
    await writeFile(file, sql, { flag: 'wx' });
    const result = spawnSync('C:\\Program Files\\Git\\bin\\bash.exe', ['-lc',
      `timeout 90s npx --yes supabase db query --linked --project-ref ${project} --file ${relativeFile}`], {
      cwd: fileURLToPath(root), encoding: 'utf8', timeout: 92000, maxBuffer: 1024 * 1024,
    });
    assert.ifError(result.error);
    assert.equal(result.status, 0, result.stdout + result.stderr);
    const response = JSON.parse(result.stdout);
    assert.ok(response.rows.some(row => row.fixture_cleaned === true && row.rerun_cleaned === true), 'recovery schemas were not cleaned up');
    console.log('Enhancement migration recovery rehearsal passed; synthetic schemas cleaned and baseline migration reran.');
  } finally {
    await rm(file, { force: true });
  }
});
