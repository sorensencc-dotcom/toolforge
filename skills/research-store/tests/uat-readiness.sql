SELECT table_schema, table_name FROM information_schema.tables
WHERE (table_schema = 'public' AND table_name IN ('documents','research_items','claims'))
   OR table_schema = 'supabase_migrations';
SELECT n.nspname, t.typname FROM pg_type t JOIN pg_namespace n ON n.oid=t.typnamespace
WHERE t.typname='research_status';
