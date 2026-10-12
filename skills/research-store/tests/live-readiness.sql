SELECT current_setting('server_version') AS postgres_version,
       (SELECT extversion FROM pg_extension WHERE extname = 'vector') AS vector_version,
       (SELECT count(*) FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name IN ('documents', 'research_items', 'claims')) AS research_tables;
