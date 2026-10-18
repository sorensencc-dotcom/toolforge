CREATE TABLE public.research_original_files (
  source_key text NOT NULL CHECK (source_key ~ '^[a-z0-9][a-z0-9-]{0,63}$'),
  relative_path text NOT NULL CHECK (relative_path <> '' AND relative_path !~ '(^/|\\|(^|/)\.\.(/|$))'),
  content_hash text NOT NULL CHECK (content_hash ~ '^[a-f0-9]{64}$'),
  byte_size bigint NOT NULL CHECK (byte_size >= 0),
  storage_key text NOT NULL,
  text_content text,
  git_sha text CHECK (git_sha IS NULL OR git_sha ~ '^[a-f0-9]{40,64}$'),
  git_state text NOT NULL CHECK (git_state IN ('committed', 'modified', 'untracked', 'not-git')),
  source_metadata jsonb NOT NULL DEFAULT '{}' CHECK (jsonb_typeof(source_metadata) = 'object'),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (source_key, relative_path),
  CHECK (storage_key = source_key || '/' || content_hash)
);

ALTER TABLE public.research_original_files ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.research_original_files FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON public.research_original_files TO service_role;
COMMENT ON TABLE public.research_original_files IS 'Private original-file catalog; source files remain authoritative. No automatic source deletion.';
