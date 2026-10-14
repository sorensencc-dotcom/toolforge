import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, writeFile, rm } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const root = new URL('../../../', import.meta.url);
const project = 'bhezixgmkhpndmezgsxk';

test('local embedding identity filters before ranking and preserves project RLS', { timeout: 100000 }, async () => {
  assert.equal((await readFile(new URL('supabase/.temp/project-ref', root), 'utf8')).trim(), project);
  const base = await readFile(new URL('../sql/001-research-store.sql', import.meta.url), 'utf8');
  const enhancement = await readFile(new URL('../sql/002-local-embeddings.sql', import.meta.url), 'utf8');
  const unsafe = enhancement.replace("ri.metadata->>'embedding_identity' = p_embedding_identity", 'true');
  assert.notEqual(unsafe, enhancement);
  for (const [index, migration] of [unsafe, enhancement].entries()) {
    const namespace = `research_model_${process.pid}`;
    const relativeFile = `skills/research-store/tests/.model-${process.pid}-${index}.sql`;
    const file = new URL(relativeFile, root);
    const sql = `BEGIN;
SET LOCAL statement_timeout = '15s';
CREATE SCHEMA ${namespace};
SET LOCAL search_path = ${namespace}, extensions, public;
${base}
${migration}
${migration}
GRANT USAGE ON SCHEMA ${namespace} TO authenticated;
INSERT INTO documents(project,git_path,title,source_type)
VALUES ('CIC','local.md','Local','archive'), ('CIC','old.md','Old','archive'),
       ('CIC','unidentified.md','Unknown','archive'), ('RewriteLabs','foreign.md','Foreign','archive');
INSERT INTO research_items(document_id,project,content,embedding,chunk_index,metadata)
SELECT id, project, title,
 (CASE WHEN title = 'Local' THEN ARRAY[0.8,0.6]::float8[] ELSE ARRAY[1.0,0.0]::float8[] END ||
 array_fill(0.0::float8, ARRAY[1534]))::vector, 0,
 CASE WHEN title = 'Old' THEN '{"embedding_identity":"old:model"}'::jsonb
      WHEN title = 'Unknown' THEN '{}'::jsonb ELSE '{"embedding_identity":"local:model"}'::jsonb END
FROM documents;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims','{"app_metadata":{"project":"CIC"}}',true);
DO $$
DECLARE query vector := (ARRAY[1.0,0.0]::float8[] || array_fill(0.0::float8, ARRAY[1534]))::vector;
BEGIN
 IF (SELECT content FROM match_research_items_for_embedding(query,'local:model',match_threshold=>0,match_count=>1)) IS DISTINCT FROM 'Local' THEN
  RAISE EXCEPTION 'Test failed: model filter before top-k';
 END IF;
 IF (SELECT count(*) FROM match_research_items_for_embedding(query,'local:model',match_threshold=>0)) <> 1 THEN
  RAISE EXCEPTION 'Test failed: model or project isolation';
 END IF;
 IF EXISTS (SELECT 1 FROM match_research_items_for_embedding(query,'missing:model',match_threshold=>0)) THEN
  RAISE EXCEPTION 'Test failed: missing model must not fall back';
 END IF;
 BEGIN
  PERFORM match_research_items_for_embedding(query,NULL);
  RAISE EXCEPTION 'Test failed: missing identity accepted';
 EXCEPTION WHEN invalid_parameter_value THEN NULL;
 END;
END $$;
RESET ROLE;
DO $$ BEGIN
 IF has_function_privilege('anon','match_research_items_for_embedding(vector,text,text,research_status,float,integer)','EXECUTE') THEN
  RAISE EXCEPTION 'Test failed: anonymous execute allowed';
 END IF;
END $$;
ROLLBACK;
SELECT to_regnamespace('${namespace}') IS NULL AS cleaned_up;
`;
    try {
      await writeFile(file, sql, { flag: 'wx' });
      const result = spawnSync('C:\\Program Files\\Git\\bin\\bash.exe', ['-lc',
        `timeout 45s npx --yes supabase db query --linked --project-ref ${project} --file ${relativeFile}`],
      { cwd: fileURLToPath(root), encoding: 'utf8', timeout: 48000, maxBuffer: 1024 * 1024 });
      assert.ifError(result.error);
      if (index === 0) {
        assert.equal(result.status, 1, 'negative control must detect mixed embedding spaces');
        assert.match(result.stdout + result.stderr, /Test failed: model filter before top-k/);
        console.log('Negative control detected mixed embedding spaces before top-k.');
      } else {
        assert.equal(result.status, 0, result.stdout + result.stderr);
        const response = JSON.parse(result.stdout);
        assert.ok(response.rows.some(row => row.cleaned_up === true));
        console.log('Embedding identity, pre-limit filtering, RLS, anonymous denial, migration rerun, and cleanup passed.');
      }
    } finally { await rm(file, { force: true }); }
  }
});
