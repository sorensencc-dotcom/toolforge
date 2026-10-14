CREATE OR REPLACE FUNCTION match_research_items_for_embedding(
  query_embedding vector, p_embedding_identity text,
  match_project text DEFAULT NULL, match_status research_status DEFAULT NULL,
  match_threshold float DEFAULT 0.7, match_count integer DEFAULT 10
) RETURNS TABLE (id uuid, content text, status research_status, similarity float,
                 metadata jsonb, document_id uuid, project text)
LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path FROM CURRENT AS $$
BEGIN
  IF query_embedding IS NULL OR vector_dims(query_embedding) <> 1536
     OR p_embedding_identity IS NULL OR p_embedding_identity = '' OR length(p_embedding_identity) > 512
     OR match_threshold IS NULL OR NOT (match_threshold BETWEEN 0 AND 1)
     OR match_count IS NULL OR NOT (match_count BETWEEN 1 AND 50)
     OR (match_project IS NOT NULL AND match_project NOT IN ('CIC', 'RewriteLabs', 'other')) THEN
    RAISE EXCEPTION 'Invalid search arguments' USING ERRCODE = '22023';
  END IF;
  RETURN QUERY SELECT ri.id, ri.content, ri.status,
    1 - (ri.embedding <=> query_embedding), ri.metadata, ri.document_id, ri.project
    FROM research_items ri
    WHERE ri.metadata->>'embedding_identity' = p_embedding_identity
      AND (match_project IS NULL OR ri.project = match_project)
      AND (match_status IS NULL OR ri.status = match_status)
      AND 1 - (ri.embedding <=> query_embedding) > match_threshold
    ORDER BY ri.embedding <=> query_embedding, ri.id LIMIT match_count;
END;
$$;

REVOKE ALL ON FUNCTION match_research_items_for_embedding(vector, text, text, research_status, float, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION match_research_items_for_embedding(vector, text, text, research_status, float, integer) TO authenticated;
