{
  "source": "mobile-grok",
  "skill": "drive-it",
  "topic": "trm",
  "title": "research-store-hybrid-supabase-mcp",
  "created": "2026-10-10T19:47:45Z",
  "folder_id": "1Faya0q0j3S62NGq_U-nxrefwbwfGQq0g",
  "status": "drop",
  "context": {
    "body": "# Research Store Hybrid (Git + Drive + Supabase) + MCP Server\n\n## Context\nImplementation-ready artifacts for a one-way hybrid research store. Git and Drive remain sources of truth; Supabase provides the central vector-searchable index for CIC claims/gaps and Rewrite Labs outputs. Includes schema with RLS, Node.js sync script, and minimal MCP server exposing semantic search, document fetch, and status list.\n\n## Payload\nArtifacts produced in this session (downloadable separately or via catalog_ingest):\n\n- `schema-rls.sql` — Full schema (documents, research_items, claims), HNSW index, match_research_items RPC, CIC/Rewrite views, and RLS policies based on JWT project claim.\n- `sync-research-to-supabase.js` — Runnable Node.js script that walks research/ markdown with YAML frontmatter, chunks, embeds (OpenAI, configurable dimension), and upserts idempotently via (project, git_path).\n- `package.json` — Dependencies for the MCP server (@modelcontextprotocol/sdk, @supabase/supabase-js, openai).\n- `mcp-server.js` — Minimal stdio MCP server with three tools:\n  - match_research_items (semantic search with project/status filters)\n  - fetch_document (by UUID, optional claims)\n  - list_by_status (filter + pagination)\n- `mcp-tool-definition.md` — Tool schema reference.\n\nKey decisions:\n- Default embedding dimension 1536 (text-embedding-3-small); set EMBEDDING_DIMENSION=384 to match kb-sync.\n- Project constraint and views for CIC / RewriteLabs.\n- Service role for sync/MCP; RLS for authenticated users.\n- One-way only. No secrets in drop.\n\n## Next\nDesktop catalog_ingest / kb-sync morning pipeline can pick this up from mobile-inbox. Schema can be applied in Supabase SQL Editor. MCP server can be registered in Claude Desktop or other agents alongside existing kb-sync local MCP."
  },
  "intent": "research_store_hybrid_supabase_mcp",
  "id": "act-1791669601795",
  "action_id": "act-1791669601795",
  "category": "RESEARCH",
  "domain": "research",
  "target": "research",
  "action_type": "antigravity_triage",
  "target_notebook_name": "TRM Research Backlog",
  "issue_url": null
}