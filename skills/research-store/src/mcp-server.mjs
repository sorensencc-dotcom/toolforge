import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import { PROJECTS, STATUSES, validateEmbeddings } from './store.mjs';
import { createReaderClient, createEmbeddingProvider } from './config.mjs';

const project = { type: 'string', enum: PROJECTS };
const status = { type: 'string', enum: STATUSES };
const tools = [
  { name: 'match_research_items', description: 'Search authorized research chunks.', inputSchema: { type: 'object', additionalProperties: false, properties: {
    query: { type: 'string', minLength: 1, maxLength: 8000 }, project, status,
    match_threshold: { type: 'number', default: 0.7, minimum: 0, maximum: 1 },
    match_count: { type: 'integer', default: 10, minimum: 1, maximum: 50 },
  }, required: ['query'] } },
  { name: 'fetch_document', description: 'Fetch authorized document, chunks, and optional claims.', inputSchema: { type: 'object', additionalProperties: false, properties: {
    document_id: { type: 'string', format: 'uuid' }, include_claims: { type: 'boolean', default: false },
  }, required: ['document_id'] } },
  { name: 'list_by_status', description: 'List authorized chunks by status.', inputSchema: { type: 'object', additionalProperties: false, properties: {
    status, project, limit: { type: 'integer', default: 20, minimum: 1, maximum: 100 },
    offset: { type: 'integer', default: 0, minimum: 0, maximum: 2147483547 },
  }, required: ['status'] } },
];

function validate(args, schema) {
  if (!args || typeof args !== 'object' || Array.isArray(args) || schema.required.some(key => !(key in args))) throw new Error('Invalid arguments');
  for (const [key, value] of Object.entries(args)) {
    const spec = schema.properties[key];
    if (!spec || (spec.type === 'integer' ? !Number.isSafeInteger(value) : typeof value !== spec.type) ||
        (spec.enum && !spec.enum.includes(value)) ||
        (typeof value === 'number' && (!Number.isFinite(value) || value < (spec.minimum ?? -Infinity) || value > (spec.maximum ?? Infinity))) ||
        (typeof value === 'string' && (!value.trim() || value.length > (spec.maxLength ?? Infinity))) ||
        (spec.format === 'uuid' && !/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(value))) throw new Error('Invalid arguments');
  }
}

export function createResearchServer({ supabase, embed }) {
  const server = new Server({ name: 'research-store', version: '0.1.0' }, { capabilities: { tools: {} } });
  server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools }));
  server.setRequestHandler(CallToolRequestSchema, async request => {
    try {
      const tool = tools.find(tool => tool.name === request.params.name);
      if (!tool) throw new Error('Unknown tool');
      const args = request.params.arguments;
      validate(args, tool.inputSchema);
      let result;
      if (tool.name === 'match_research_items') {
        const [embedding] = validateEmbeddings(await embed([args.query]), 1);
        if (!embed.identity) throw new Error('Embedding identity required');
        const response = await supabase.rpc('match_research_items_for_embedding', {
          p_embedding_identity: embed.identity,
          query_embedding: embedding, match_project: args.project ?? null, match_status: args.status ?? null,
          match_threshold: args.match_threshold ?? 0.7, match_count: args.match_count ?? 10,
        });
        if (response.error) throw new Error('Search failed');
        result = response.data;
      } else if (tool.name === 'fetch_document') {
        const doc = await supabase.from('documents').select('*').eq('id', args.document_id).maybeSingle();
        if (doc.error || !doc.data) throw new Error('Document unavailable');
        const items = await supabase.from('research_items').select('id,content,status,confidence,chunk_index,metadata,created_at').eq('document_id', args.document_id).order('chunk_index');
        if (items.error) throw new Error('Fetch failed');
        result = { document: doc.data, research_items: items.data };
        if (args.include_claims) {
          const claims = await supabase.from('claims').select('*').eq('document_id', args.document_id);
          if (claims.error) throw new Error('Fetch failed');
          result.claims = claims.data;
        }
      } else {
        let query = supabase.from('research_items').select('id,document_id,project,content,status,confidence,chunk_index,metadata,created_at')
          .eq('status', args.status).order('created_at', { ascending: false }).order('id');
        if (args.project) query = query.eq('project', args.project);
        const response = await query.range(args.offset ?? 0, (args.offset ?? 0) + (args.limit ?? 20) - 1);
        if (response.error) throw new Error('List failed');
        result = response.data;
      }
      return { content: [{ type: 'text', text: JSON.stringify(result) }] };
    } catch {
      return { isError: true, content: [{ type: 'text', text: 'Research request failed: check arguments, access, and provider availability.' }] };
    }
  });
  return server;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const supabase = createReaderClient(process.env);
    const embed = createEmbeddingProvider(process.env);
    await createResearchServer({ supabase, embed }).connect(new StdioServerTransport());
  } catch (error) { console.error(error.message); process.exitCode = 1; }
}
