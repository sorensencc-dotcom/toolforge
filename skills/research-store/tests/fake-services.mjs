import { createServer } from 'node:http';
import { randomUUID, createHmac, randomBytes, createHash } from 'node:crypto';

export function syntheticEmbedding(text) {
  const vector = Array(1536).fill(0);
  vector[createHash('sha256').update(text).digest().readUInt16BE(0) % 1536] = 1;
  return vector;
}

export async function startFakeServices() {
  const secret = randomBytes(32);
  const writer = randomBytes(24).toString('hex');
  const embeddingKey = randomBytes(24).toString('hex');
  const state = { documents: new Map(), items: [], claims: [], requests: [], embeddingFailure: false, writeFailure: false,
    embeddingDigest: 'a'.repeat(64), embeddingDimensions: 1536, embeddingEcho: null, embeddingRedirect: false };
  const sign = (project, expired = false) => {
    const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
    const body = Buffer.from(JSON.stringify({ role: 'authenticated', project, exp: Math.floor(Date.now() / 1000) + (expired ? -1 : 300) })).toString('base64url');
    return `${header}.${body}.${createHmac('sha256', secret).update(`${header}.${body}`).digest('base64url')}`;
  };
  const server = createServer(async (request, response) => {
    const send = (code, body) => { response.writeHead(code, { 'content-type': 'application/json' }); response.end(JSON.stringify(body)); };
    try {
      const url = new URL(request.url, 'http://127.0.0.1');
      const parts = [];
      for await (const part of request) parts.push(part);
      const input = parts.length ? JSON.parse(Buffer.concat(parts).toString()) : null;
      state.requests.push({ path: url.pathname, authorization: request.headers.authorization, input, query: url.search });
      if (url.pathname === '/api/tags') return send(200, { models: [{ name: 'synthetic-embedding', digest: state.embeddingDigest }] });
      if (url.pathname === '/api/embed' || url.pathname === '/v1/embeddings') {
        if (state.embeddingRedirect) { response.writeHead(302, { location: 'https://api.openai.com/v1/embeddings' }); return response.end(); }
        if (url.pathname === '/v1/embeddings' && request.headers.authorization !== `Bearer ${embeddingKey}`) return send(401, { error: 'Router credential required' });
        if (state.embeddingFailure) return send(503, { error: { message: 'Synthetic embedding failure' } });
        const vectors = input.input.map(text => syntheticEmbedding(text).slice(0, state.embeddingDimensions));
        if (url.pathname === '/api/embed') return send(200, { model: state.embeddingEcho ?? input.model, embeddings: vectors });
        return send(200, { object: 'list', data: input.input.map((text, index) => {
          const values = syntheticEmbedding(text).slice(0, state.embeddingDimensions);
          const embedding = input.encoding_format === 'base64' ? Buffer.from(new Float32Array(values).buffer).toString('base64') : values;
          return { object: 'embedding', index, embedding };
        }).reverse(), model: state.embeddingEcho ?? input.model, usage: { prompt_tokens: 1, total_tokens: 1 } });
      }
      const bearer = request.headers.authorization?.replace(/^Bearer /, '');
      if (url.pathname === '/rest/v1/rpc/replace_research_document') {
        if (bearer !== writer) return send(403, { message: 'Writer required' });
        if (state.writeFailure) return send(503, { message: 'Synthetic write failure' });
        const key = `${input.p_document.project}:${input.p_document.git_path}`;
        const previous = state.documents.get(key);
        const doc = { ...input.p_document, id: previous?.id ?? randomUUID() };
        const old = state.items.filter(item => item.document_id === doc.id);
        const items = input.p_items.map(item => ({ ...item, document_id: doc.id,
          id: old.find(row => row.chunk_index === item.chunk_index)?.id ?? randomUUID(), created_at: '2026-10-11T00:00:00Z' }));
        state.documents.set(key, doc);
        state.items = [...state.items.filter(item => item.document_id !== doc.id), ...items];
        return send(200, doc.id);
      }
      const [header, body, signature] = (bearer ?? '').split('.');
      if (!body || createHmac('sha256', secret).update(`${header}.${body}`).digest('base64url') !== signature) return send(401, { message: 'Invalid reader token' });
      const claims = JSON.parse(Buffer.from(body, 'base64url'));
      if (claims.exp <= Date.now() / 1000) return send(401, { message: 'Expired reader token' });
      let rows;
      if (url.pathname === '/rest/v1/rpc/match_research_items' || url.pathname === '/rest/v1/rpc/match_research_items_for_embedding') {
        const query = input.query_embedding;
        if (!Array.isArray(query) || query.length !== 1536 || !query.every(Number.isFinite) || !query.some(value => value !== 0)) return send(400, { message: 'Invalid query vector' });
        const cosine = vector => vector.reduce((sum, value, index) => sum + value * query[index], 0) /
          Math.sqrt(vector.reduce((sum, value) => sum + value * value, 0) * query.reduce((sum, value) => sum + value * value, 0));
        rows = state.items.filter(row => row.project === claims.project &&
          (url.pathname.endsWith('/match_research_items') || (input.p_embedding_identity && row.metadata?.embedding_identity === input.p_embedding_identity)) &&
          (!input.match_project || row.project === input.match_project) && (!input.match_status || row.status === input.match_status))
          .map(row => ({ ...row, similarity: cosine(row.embedding) }))
          .filter(row => row.similarity > input.match_threshold)
          .sort((a, b) => b.similarity - a.similarity || a.id.localeCompare(b.id)).slice(0, input.match_count);
      } else {
        const table = url.pathname.split('/').at(-1);
        rows = table === 'documents' ? [...state.documents.values()] : table === 'research_items' ? state.items : table === 'claims' ? state.claims : null;
        if (!rows) return send(404, { message: 'Unknown fixture endpoint' });
        rows = rows.filter(row => row.project === claims.project);
        for (const key of ['id', 'document_id', 'status', 'project']) {
          const filter = url.searchParams.get(key);
          if (filter?.startsWith('eq.')) rows = rows.filter(row => row[key] === filter.slice(3));
        }
        rows = [...rows].sort((a, b) => url.searchParams.get('order')?.startsWith('chunk_index') ? a.chunk_index - b.chunk_index : a.id.localeCompare(b.id));
        const offset = Number(url.searchParams.get('offset') ?? 0);
        rows = rows.slice(offset, offset + Number(url.searchParams.get('limit') ?? rows.length));
        if (request.headers.accept?.includes('vnd.pgrst.object')) return send(200, rows[0] ?? null);
      }
      return send(200, rows);
    } catch { send(500, { message: 'Invalid synthetic request' }); }
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  return { state, sign, env: {
    SUPABASE_URL: `http://127.0.0.1:${server.address().port}`,
    SUPABASE_ANON_KEY: randomBytes(24).toString('hex'), SUPABASE_SERVICE_ROLE_KEY: writer,
    EMBEDDING_MODEL: 'synthetic-embedding', EMBEDDING_PROVIDER: 'ollama',
    OLLAMA_BASE_URL: `http://127.0.0.1:${server.address().port}`,
    FREELLM_API_KEY: embeddingKey, FREELLM_BASE_URL: `http://127.0.0.1:${server.address().port}/v1`,
  }, close: () => new Promise(resolve => { server.closeAllConnections(); server.close(resolve); }) };
}
