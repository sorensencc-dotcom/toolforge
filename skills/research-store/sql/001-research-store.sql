CREATE EXTENSION IF NOT EXISTS vector WITH SCHEMA extensions;
CREATE TYPE research_status AS ENUM ('VERIFIED', 'INFERRED', 'UNKNOWN', 'NEEDS_REVIEW');

CREATE TABLE documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project text NOT NULL CHECK (project IN ('CIC', 'RewriteLabs', 'other')),
  title text NOT NULL,
  source_uri text,
  source_type text NOT NULL,
  source_system text NOT NULL DEFAULT 'git',
  git_path text NOT NULL CHECK (git_path <> '' AND git_path !~ '(^/|\\|(^|/)\.\.(/|$))'),
  git_sha text,
  drive_file_id text,
  content_hash text,
  metadata jsonb NOT NULL DEFAULT '{}' CHECK (jsonb_typeof(metadata) = 'object'),
  ingested_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (project, git_path),
  UNIQUE (id, project)
);

CREATE TABLE research_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id uuid NOT NULL,
  project text NOT NULL,
  content text NOT NULL,
  embedding vector(1536) NOT NULL,
  status research_status NOT NULL DEFAULT 'UNKNOWN',
  confidence numeric CHECK (confidence BETWEEN 0 AND 1),
  chunk_index integer NOT NULL CHECK (chunk_index >= 0),
  token_count integer CHECK (token_count >= 0),
  metadata jsonb NOT NULL DEFAULT '{}' CHECK (jsonb_typeof(metadata) = 'object'),
  created_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (document_id, project) REFERENCES documents(id, project) ON DELETE CASCADE,
  UNIQUE (document_id, chunk_index),
  UNIQUE (id, document_id, project)
);

CREATE TABLE claims (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id uuid NOT NULL,
  research_item_id uuid,
  project text NOT NULL,
  statement text NOT NULL,
  status research_status NOT NULL DEFAULT 'UNKNOWN',
  supporting_ids uuid[] NOT NULL DEFAULT '{}',
  metadata jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (document_id, project) REFERENCES documents(id, project) ON DELETE CASCADE,
  FOREIGN KEY (research_item_id, document_id, project)
    REFERENCES research_items(id, document_id, project) ON DELETE SET NULL (research_item_id)
);

CREATE INDEX research_items_embedding_hnsw ON research_items USING hnsw (embedding vector_cosine_ops);
CREATE INDEX research_items_project_status_idx ON research_items(project, status);
CREATE INDEX claims_document_idx ON claims(document_id);

ALTER TABLE documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE research_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE claims ENABLE ROW LEVEL SECURITY;

CREATE POLICY documents_select ON documents FOR SELECT TO authenticated USING (
  project = COALESCE(NULLIF(current_setting('request.jwt.claims', true), '')::jsonb ->> 'project',
    NULLIF(current_setting('request.jwt.claims', true), '')::jsonb #>> '{app_metadata,project}')
  OR (NULLIF(current_setting('request.jwt.claims', true), '')::jsonb #>> '{app_metadata,research_admin}') = 'true'
);
CREATE POLICY research_items_select ON research_items FOR SELECT TO authenticated USING (
  project = COALESCE(NULLIF(current_setting('request.jwt.claims', true), '')::jsonb ->> 'project',
    NULLIF(current_setting('request.jwt.claims', true), '')::jsonb #>> '{app_metadata,project}')
  OR (NULLIF(current_setting('request.jwt.claims', true), '')::jsonb #>> '{app_metadata,research_admin}') = 'true'
);
CREATE POLICY claims_select ON claims FOR SELECT TO authenticated USING (
  project = COALESCE(NULLIF(current_setting('request.jwt.claims', true), '')::jsonb ->> 'project',
    NULLIF(current_setting('request.jwt.claims', true), '')::jsonb #>> '{app_metadata,project}')
  OR (NULLIF(current_setting('request.jwt.claims', true), '')::jsonb #>> '{app_metadata,research_admin}') = 'true'
);

CREATE VIEW cic_items WITH (security_invoker = true) AS SELECT * FROM research_items WHERE project = 'CIC';
CREATE VIEW rewrite_items WITH (security_invoker = true) AS SELECT * FROM research_items WHERE project = 'RewriteLabs';
CREATE VIEW cic_claims WITH (security_invoker = true) AS SELECT * FROM claims WHERE project = 'CIC';

CREATE FUNCTION match_research_items(
  query_embedding vector, match_project text DEFAULT NULL,
  match_status research_status DEFAULT NULL, match_threshold float DEFAULT 0.7,
  match_count integer DEFAULT 10
) RETURNS TABLE (id uuid, content text, status research_status, similarity float,
                 metadata jsonb, document_id uuid, project text)
LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path FROM CURRENT AS $$
BEGIN
  IF query_embedding IS NULL OR vector_dims(query_embedding) <> 1536
     OR match_threshold IS NULL OR NOT (match_threshold BETWEEN 0 AND 1)
     OR match_count IS NULL OR NOT (match_count BETWEEN 1 AND 50)
     OR (match_project IS NOT NULL AND match_project NOT IN ('CIC', 'RewriteLabs', 'other')) THEN
    RAISE EXCEPTION 'Invalid search arguments' USING ERRCODE = '22023';
  END IF;
  RETURN QUERY SELECT ri.id, ri.content, ri.status,
    1 - (ri.embedding <=> query_embedding), ri.metadata, ri.document_id, ri.project
    FROM research_items ri
    WHERE (match_project IS NULL OR ri.project = match_project)
      AND (match_status IS NULL OR ri.status = match_status)
      AND 1 - (ri.embedding <=> query_embedding) > match_threshold
    ORDER BY ri.embedding <=> query_embedding, ri.id LIMIT match_count;
END;
$$;

CREATE FUNCTION replace_research_document(p_document jsonb, p_items jsonb) RETURNS uuid
LANGUAGE plpgsql SECURITY INVOKER SET search_path FROM CURRENT AS $$
DECLARE document_uuid uuid; item jsonb;
BEGIN
  IF jsonb_typeof(p_document) IS DISTINCT FROM 'object'
     OR jsonb_typeof(p_items) IS DISTINCT FROM 'array' THEN
    RAISE EXCEPTION 'Invalid replacement arguments' USING ERRCODE = '22023';
  END IF;
  INSERT INTO documents(project, title, source_uri, source_type, source_system, git_path,
    git_sha, drive_file_id, content_hash, metadata)
  VALUES (p_document->>'project', p_document->>'title', p_document->>'source_uri',
    p_document->>'source_type', COALESCE(p_document->>'source_system', 'git'), p_document->>'git_path',
    p_document->>'git_sha', p_document->>'drive_file_id', p_document->>'content_hash',
    COALESCE(p_document->'metadata', '{}'::jsonb))
  ON CONFLICT (project, git_path) DO UPDATE SET title = EXCLUDED.title,
    source_uri = EXCLUDED.source_uri, source_type = EXCLUDED.source_type,
    source_system = EXCLUDED.source_system, git_sha = EXCLUDED.git_sha,
    drive_file_id = EXCLUDED.drive_file_id, content_hash = EXCLUDED.content_hash,
    metadata = EXCLUDED.metadata, updated_at = now()
  RETURNING id INTO document_uuid;

  FOR item IN SELECT value FROM jsonb_array_elements(p_items) LOOP
    IF item->>'project' IS DISTINCT FROM p_document->>'project' THEN
      RAISE EXCEPTION 'Chunk project mismatch' USING ERRCODE = '23514';
    END IF;
    UPDATE claims c SET research_item_id = NULL, status = 'NEEDS_REVIEW'
      FROM research_items ri WHERE c.research_item_id = ri.id
      AND ri.document_id = document_uuid AND ri.chunk_index = (item->>'chunk_index')::integer
      AND ri.content IS DISTINCT FROM item->>'content';
    INSERT INTO research_items(document_id, project, content, embedding, status,
      confidence, chunk_index, token_count, metadata)
    VALUES (document_uuid, item->>'project', item->>'content', (item->'embedding')::text::vector,
      COALESCE(item->>'status', 'UNKNOWN')::research_status, (item->>'confidence')::numeric,
      (item->>'chunk_index')::integer, (item->>'token_count')::integer,
      COALESCE(item->'metadata', '{}'::jsonb))
    ON CONFLICT (document_id, chunk_index) DO UPDATE SET content = EXCLUDED.content,
      embedding = EXCLUDED.embedding, status = EXCLUDED.status, confidence = EXCLUDED.confidence,
      token_count = EXCLUDED.token_count, metadata = EXCLUDED.metadata;
  END LOOP;
  UPDATE claims c SET research_item_id = NULL, status = 'NEEDS_REVIEW'
    FROM research_items ri WHERE c.research_item_id = ri.id AND ri.document_id = document_uuid
    AND ri.chunk_index NOT IN (SELECT (value->>'chunk_index')::integer FROM jsonb_array_elements(p_items));
  DELETE FROM research_items WHERE document_id = document_uuid AND chunk_index NOT IN
    (SELECT (value->>'chunk_index')::integer FROM jsonb_array_elements(p_items));
  RETURN document_uuid;
END;
$$;

REVOKE ALL ON documents, research_items, claims, cic_items, rewrite_items, cic_claims FROM PUBLIC, anon, authenticated;
GRANT SELECT ON documents, research_items, claims, cic_items, rewrite_items, cic_claims TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON documents, research_items, claims TO service_role;
REVOKE ALL ON FUNCTION match_research_items(vector, text, research_status, float, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION match_research_items(vector, text, research_status, float, integer) TO authenticated;
REVOKE ALL ON FUNCTION replace_research_document(jsonb, jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION replace_research_document(jsonb, jsonb) TO service_role;
