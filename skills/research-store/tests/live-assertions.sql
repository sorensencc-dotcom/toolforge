GRANT USAGE ON SCHEMA research_store_test_124 TO authenticated, anon, service_role;
CREATE TABLE test_results (name text PRIMARY KEY);
GRANT INSERT, SELECT ON test_results TO authenticated, anon, service_role;
CREATE FUNCTION check_test(ok boolean, name text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  IF ok IS DISTINCT FROM true THEN RAISE EXCEPTION 'Test failed: %', name; END IF;
  INSERT INTO test_results VALUES (name);
END;
$$;
CREATE FUNCTION fixture_vector(n integer DEFAULT 1536) RETURNS vector LANGUAGE sql AS $$
  SELECT ('[' || array_to_string(array_fill(0.1, ARRAY[n]), ',') || ']')::vector;
$$;

INSERT INTO documents(id, project, title, source_type, git_path) VALUES
  ('11111111-1111-4111-8111-111111111111', 'CIC', 'CIC', 'archive', 'cic.md'),
  ('22222222-2222-4222-8222-222222222222', 'RewriteLabs', 'Rewrite', 'archive', 'rewrite.md');
INSERT INTO research_items(document_id, project, content, embedding, chunk_index)
  SELECT id, project, title, fixture_vector(), 0 FROM documents;
INSERT INTO claims(document_id, project, statement) SELECT id, project, title FROM documents;

SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claims = '{"project":"CIC"}';
SELECT check_test((SELECT count(*) = 1 FROM documents), 'CIC documents isolation');
SELECT check_test((SELECT count(*) = 1 FROM research_items), 'CIC chunks isolation');
SELECT check_test((SELECT count(*) = 1 FROM claims), 'CIC claims isolation');
SELECT check_test((SELECT count(*) = 1 FROM cic_items), 'CIC invoker view');
SELECT check_test((SELECT count(*) = 0 FROM rewrite_items), 'foreign invoker view');
SELECT check_test((SELECT count(*) = 1 FROM cic_claims), 'claims invoker view');
SELECT check_test((SELECT count(*) = 1 FROM match_research_items(fixture_vector())), 'search without project filter');
SELECT check_test((SELECT count(*) = 0 FROM match_research_items(fixture_vector(), 'RewriteLabs')), 'foreign project search');
SELECT check_test((SELECT count(*) = 0 FROM documents WHERE id = '22222222-2222-4222-8222-222222222222'), 'foreign UUID fetch');
DO $$
BEGIN
  BEGIN
    PERFORM replace_research_document('{}', '[]');
    RAISE EXCEPTION 'Reader unexpectedly executed writer';
  EXCEPTION WHEN insufficient_privilege THEN
    PERFORM check_test(true, 'reader writer-RPC denial');
  END;
  BEGIN
    INSERT INTO documents(project, title, source_type, git_path) VALUES ('CIC','bad','archive','bad.md');
    RAISE EXCEPTION 'Reader unexpectedly inserted document';
  EXCEPTION WHEN insufficient_privilege THEN
    PERFORM check_test(true, 'reader table-write denial');
  END;
  BEGIN
    PERFORM * FROM match_research_items(fixture_vector(384));
    RAISE EXCEPTION 'Search accepted 384 dimensions';
  EXCEPTION WHEN invalid_parameter_value THEN
    PERFORM check_test(true, 'search dimension rejection');
  END;
END;
$$;
SET LOCAL request.jwt.claims = '{}';
SELECT check_test((SELECT count(*) = 0 FROM documents), 'missing claims deny rows');
SET LOCAL request.jwt.claims = '{"app_metadata":{"project":"CIC"}}';
SELECT check_test((SELECT count(*) = 1 FROM documents), 'trusted Auth project reads documents');
SELECT check_test((SELECT count(*) = 1 FROM match_research_items(fixture_vector())), 'trusted Auth project searches');
SET LOCAL request.jwt.claims = '{"user_metadata":{"project":"CIC","research_admin":true}}';
SELECT check_test((SELECT count(*) = 0 FROM documents), 'user metadata cannot grant project');
SET LOCAL request.jwt.claims = '{"project":"CIC","user_metadata":{"research_admin":true}}';
SELECT check_test((SELECT count(*) = 1 FROM documents), 'user metadata cannot grant admin');
SET LOCAL request.jwt.claims = '{"app_metadata":{"research_admin":true}}';
SELECT check_test((SELECT count(*) = 2 FROM documents), 'trusted admin sees both projects');
SET LOCAL request.jwt.claims = '{"project":"RewriteLabs"}';
SELECT check_test((SELECT count(*) = 1 FROM research_items WHERE project = 'RewriteLabs'), 'RewriteLabs reader isolation');
RESET ROLE;

SET LOCAL ROLE anon;
DO $$
BEGIN
  BEGIN
    PERFORM * FROM match_research_items(fixture_vector());
    RAISE EXCEPTION 'Anon unexpectedly searched';
  EXCEPTION WHEN insufficient_privilege THEN
    PERFORM check_test(true, 'anonymous search denial');
  END;
  BEGIN
    PERFORM * FROM documents;
    RAISE EXCEPTION 'Anon unexpectedly read documents';
  EXCEPTION WHEN insufficient_privilege THEN
    PERFORM check_test(true, 'anonymous table denial');
  END;
END;
$$;
RESET ROLE;

DO $$
BEGIN
  BEGIN
    INSERT INTO research_items(document_id,project,content,embedding,chunk_index)
      VALUES ('11111111-1111-4111-8111-111111111111','RewriteLabs','bad',fixture_vector(),1);
    RAISE EXCEPTION 'Chunk project mismatch accepted';
  EXCEPTION WHEN foreign_key_violation THEN
    PERFORM check_test(true, 'chunk project integrity');
  END;
  BEGIN
    INSERT INTO claims(document_id,project,statement)
      VALUES ('11111111-1111-4111-8111-111111111111','RewriteLabs','bad');
    RAISE EXCEPTION 'Claim project mismatch accepted';
  EXCEPTION WHEN foreign_key_violation THEN
    PERFORM check_test(true, 'claim project integrity');
  END;
END;
$$;

SET LOCAL ROLE service_role;
DO $$
DECLARE
  doc jsonb := '{"project":"CIC","git_path":"atomic.md","title":"Original","source_type":"archive","content_hash":"old"}';
  items jsonb;
  doc_id uuid;
  survivor uuid;
  obsolete uuid;
  claim_id uuid;
BEGIN
  SELECT jsonb_agg(jsonb_build_object('project','CIC','content','Chunk ' || n,'chunk_index',n,
    'embedding',fixture_vector()::text::jsonb)) INTO items FROM generate_series(0,2) n;
  doc_id := replace_research_document(doc, items);
  SELECT id INTO survivor FROM research_items WHERE document_id = doc_id AND chunk_index = 0;
  SELECT id INTO obsolete FROM research_items WHERE document_id = doc_id AND chunk_index = 2;
  INSERT INTO claims(document_id,research_item_id,project,statement)
    VALUES (doc_id,obsolete,'CIC','Retain claim') RETURNING id INTO claim_id;
  PERFORM replace_research_document(doc, items);
  PERFORM check_test((SELECT count(*) = 3 FROM research_items WHERE document_id = doc_id), 'repeat-run idempotent count');
  PERFORM check_test((SELECT id = survivor FROM research_items WHERE document_id = doc_id AND chunk_index = 0), 'repeat-run stable IDs');
  PERFORM replace_research_document(doc || '{"title":"Updated"}'::jsonb, jsonb_build_array(items->0));
  PERFORM check_test((SELECT count(*) = 1 FROM research_items WHERE document_id = doc_id), 'shrinking removes stale chunks');
  PERFORM check_test((SELECT title = 'Updated' FROM documents WHERE id = doc_id), 'metadata-only title update');
  PERFORM check_test((SELECT research_item_id IS NULL AND statement = 'Retain claim' FROM claims WHERE id = claim_id), 'obsolete chunk detaches claim');
  INSERT INTO claims(document_id,research_item_id,project,statement,status)
    VALUES (doc_id,survivor,'CIC','Evidence must not silently change','VERIFIED') RETURNING id INTO claim_id;
  PERFORM replace_research_document(doc || '{"title":"Updated"}'::jsonb,
    jsonb_build_array((items->0) || '{"content":"Different evidence"}'::jsonb));
  PERFORM check_test((SELECT research_item_id IS NULL AND status = 'NEEDS_REVIEW' FROM claims WHERE id = claim_id), 'changed content invalidates claim evidence');
  BEGIN
    PERFORM replace_research_document(doc || '{"content_hash":"new"}'::jsonb,
      jsonb_build_array((items->0) || jsonb_build_object('embedding',fixture_vector(384)::text::jsonb)));
    RAISE EXCEPTION 'Write accepted wrong dimensions';
  EXCEPTION WHEN data_exception THEN
    PERFORM check_test(true, 'write dimension rejection');
  END;
  PERFORM check_test((SELECT title = 'Updated' AND content_hash = 'old' FROM documents WHERE id = doc_id), 'failed replacement rolls back metadata');
  PERFORM check_test((SELECT count(*) = 1 FROM research_items WHERE document_id = doc_id AND id = survivor AND content = 'Different evidence'), 'failed replacement preserves chunks');
  PERFORM replace_research_document(doc, '[]');
  PERFORM check_test((SELECT count(*) = 0 FROM research_items WHERE document_id = doc_id), 'empty replacement clears chunks');
END;
$$;
RESET ROLE;

SELECT check_test((SELECT count(*) = 33 FROM test_results), 'all 33 required checks executed');
SELECT count(*) AS passed, jsonb_agg(name ORDER BY name) AS checks FROM test_results;
