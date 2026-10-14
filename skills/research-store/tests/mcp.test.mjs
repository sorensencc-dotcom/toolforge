import test from 'node:test';
import assert from 'node:assert/strict';

async function clientFor(t, dependencies) {
  const { createResearchServer } = await import('../src/mcp-server.mjs');
  const { Client } = await import('@modelcontextprotocol/sdk/client/index.js');
  const { InMemoryTransport } = await import('@modelcontextprotocol/sdk/inMemory.js');
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  const server = createResearchServer(dependencies);
  const client = new Client({ name: 'research-store-tests', version: '1.0.0' });
  t.after(async () => { await client.close(); await server.close(); });
  await server.connect(serverTransport);
  await client.connect(clientTransport);
  return client;
}

test('MCP lists exactly three documented read tools', async t => {
  const client = await clientFor(t, { supabase: {}, embed: async () => [] });
  const { tools } = await client.listTools();
  assert.deepEqual(tools.map(tool => tool.name).sort(), ['fetch_document', 'list_by_status', 'match_research_items']);
});

test('invalid MCP arguments fail before embedding or database calls', async t => {
  let calls = 0;
  const client = await clientFor(t, {
    supabase: { rpc: async () => { calls++; }, from: () => { calls++; } },
    embed: async () => { calls++; return []; },
  });
  const cases = [
    ['match_research_items', {}],
    ['match_research_items', { query: '   ' }],
    ['match_research_items', { query: 'x'.repeat(8001) }],
    ['match_research_items', { query: 'valid', match_count: 1.5 }],
    ['match_research_items', { query: 'valid', match_count: 51 }],
    ['match_research_items', { query: 'valid', match_threshold: -0.1 }],
    ['match_research_items', { query: 'valid', match_threshold: 1.1 }],
    ['match_research_items', { query: 'valid', project: 'foreign' }],
    ['match_research_items', { query: 'valid', unexpected: true }],
    ['fetch_document', { document_id: 'invalid' }],
    ['list_by_status', { status: 'approved' }],
    ['list_by_status', { status: 'UNKNOWN', limit: 101 }],
    ['list_by_status', { status: 'UNKNOWN', offset: -1 }],
  ];
  for (const [name, args] of cases) {
    const result = await client.callTool({ name, arguments: args });
    assert.equal(result.isError, true, `${name}: ${JSON.stringify(args)}`);
  }
  assert.equal(calls, 0);
});

test('semantic search uses reader client, issue defaults, and supplied filters', async t => {
  const calls = [];
  const embedding = Array(1536).fill(0.1);
  const row = { id: 'result', project: 'CIC', content: 'Visible result' };
  const client = await clientFor(t, {
    supabase: { rpc: async (...args) => { calls.push(args); return { data: [row], error: null }; } },
    embed: Object.assign(async texts => { assert.deepEqual(texts, ['question']); return [embedding]; }, { identity: 'fixture:model:1536' }),
  });
  const response = await client.callTool({ name: 'match_research_items', arguments: { query: 'question' } });
  assert.notEqual(response.isError, true);
  assert.deepEqual(JSON.parse(response.content[0].text), [row]);
  assert.deepEqual(calls[0], ['match_research_items_for_embedding', {
    p_embedding_identity: 'fixture:model:1536',
    query_embedding: embedding, match_project: null, match_status: null, match_threshold: 0.7, match_count: 10,
  }]);
  await client.callTool({ name: 'match_research_items', arguments: { query: 'question', project: 'CIC', status: 'VERIFIED', match_count: 50, match_threshold: 0 } });
  assert.equal(calls[1][1].match_project, 'CIC');
  assert.equal(calls[1][1].match_status, 'VERIFIED');
  assert.equal(calls[1][1].match_count, 50);
  assert.equal(calls[1][1].match_threshold, 0);
});

test('provider errors cannot disclose secrets in MCP responses', async t => {
  const secret = Array.from({ length: 12 }, (_, i) => String.fromCharCode(65 + i)).join('');
  const client = await clientFor(t, {
    supabase: {}, embed: async () => { throw new Error(`Authorization: ${secret}`); },
  });
  const response = await client.callTool({ name: 'match_research_items', arguments: { query: 'question' } });
  assert.equal(response.isError, true);
  assert.ok(response.content[0].text.length > 0);
  assert.ok(!response.content[0].text.includes(secret));
});
