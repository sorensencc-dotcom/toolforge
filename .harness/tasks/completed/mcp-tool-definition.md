{
  "id": "act-1791669602076-mcp-tool-definition",
  "source": "mobile-grok",
  "action_type": "antigravity_triage",
  "intent": "research_store_mcp_tool_definition",
  "category": "RESEARCH",
  "domain": "trm",
  "target": "research",
  "summary": "MCP Tool Definition for Research Store",
  "context": {
    "body": "# MCP Tool Definition — Research Store\n\nExpose Supabase research retrieval as an MCP tool for Claude Desktop, Grok, or other agents.\n\n## Tool: match_research_items\n\n```json\n{\n  \"name\": \"match_research_items\",\n  \"description\": \"Semantic search over CIC and Rewrite Labs research items. Supports project and status filters. Returns ranked chunks with similarity score and provenance metadata.\",\n  \"inputSchema\": {\n    \"type\": \"object\",\n    \"properties\": {\n      \"query\": {\n        \"type\": \"string\",\n        \"description\": \"Natural language query to embed and search\"\n      },\n      \"project\": {\n        \"type\": \"string\",\n        \"enum\": [\"CIC\", \"RewriteLabs\", \"other\"],\n        \"description\": \"Optional project filter\"\n      },\n      \"status\": {\n        \"type\": \"string\",\n        \"enum\": [\"VERIFIED\", \"INFERRED\", \"UNKNOWN\", \"NEEDS_REVIEW\"],\n        \"description\": \"Optional status filter\"\n      },\n      \"match_threshold\": {\n        \"type\": \"number\",\n        \"default\": 0.7,\n        \"minimum\": 0,\n        \"maximum\": 1\n      },\n      \"match_count\": {\n        \"type\": \"integer\",\n        \"default\": 10,\n        \"minimum\": 1,\n        \"maximum\": 50\n      }\n    },\n    \"required\": [\"query\"]\n  }\n}\n```\n\n## Example MCP server handler (Node.js sketch)\n\n```javascript\n// In your MCP server (e.g. extending kb-sync MCP or new server)\nimport { createClient } from '@supabase/supabase-js';\nimport OpenAI from 'openai';\n\nconst supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);\nconst openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });\n\nasync function handleMatchResearchItems(args) {\n  const embedding = (await openai.embeddings.create({\n    model: 'text-embedding-3-small',\n    input: args.query,\n    dimensions: 1536,\n  })).data[0].embedding;\n\n  const { data, error } = await supabase.rpc('match_research_items', {\n    query_embedding: embedding,\n    match_project: args.project || null,\n    match_status: args.status || null,\n    match_threshold: args.match_threshold ?? 0.7,\n    match_count: args.match_count ?? 10,\n  });\n\n  if (error) throw error;\n  return data;\n}\n\n// Register in MCP tools/list + tools/call\n```\n\n## Integration notes\n- Prefer service role key on the MCP server (server-side only).\n- For user-scoped access, pass JWT and rely on RLS (project claim in JWT).\n- Can coexist with existing kb-sync local MCP (`query_context_cache`) — use local for hot/low-latency, Supabase for cross-project or remote agents.\n- CIC-specific helper: wrap with default `project: \"CIC\"` and status filter `VERIFIED`.",
    "raw_input": "MCP Tool Definition for Research Store",
    "provider": "deterministic_fallback"
  },
  "action_id": "act-1791669602076-mcp-tool-definition",
  "priority": "P2",
  "execution_plan": [
    {
      "step": 1,
      "handler": "antigravity",
      "action": "create_issue_and_stage"
    }
  ],
  "target_notebook_name": "TRM Research Backlog",
  "issue_url": null
}