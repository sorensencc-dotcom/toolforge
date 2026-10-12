import OpenAI from 'openai';
import { createClient } from '@supabase/supabase-js';
import { validateEmbeddings } from './store.mjs';

function required(env, name) {
  if (!env[name]?.trim()) throw new Error(`${name} required`);
  return env[name];
}

export function createEmbeddingProvider(env) {
  if ((env.EMBEDDING_MODEL && env.EMBEDDING_MODEL !== 'text-embedding-3-small') ||
      (env.EMBEDDING_DIMENSION && env.EMBEDDING_DIMENSION !== '1536') ||
      (env.EMBEDDING_PROVIDER && env.EMBEDDING_PROVIDER !== 'openai')) throw new Error('Unsupported embedding configuration');
  const client = new OpenAI({ apiKey: required(env, 'OPENAI_API_KEY'), baseURL: env.OPENAI_BASE_URL, maxRetries: 0, timeout: 10000 });
  return async texts => {
    const response = await client.embeddings.create({ model: 'text-embedding-3-small', dimensions: 1536, input: texts });
    const data = response.data;
    if (!Array.isArray(data) || data.length !== texts.length || new Set(data.map(row => row.index)).size !== texts.length ||
        data.some(row => !Number.isInteger(row.index) || row.index < 0 || row.index >= texts.length)) throw new Error('Invalid embedding response');
    return validateEmbeddings([...data].sort((a, b) => a.index - b.index).map(row => row.embedding), texts.length);
  };
}

export function createReaderClient(env) {
  const token = required(env, 'SUPABASE_READER_JWT');
  let claims;
  try { claims = JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString()); }
  catch { throw new Error('Invalid SUPABASE_READER_JWT'); }
  // Supabase verifies the signature; this check prevents accidentally using a writer token.
  if (claims.role !== 'authenticated' || !Number.isFinite(claims.exp) || claims.exp <= Date.now() / 1000) throw new Error('Invalid or expired SUPABASE_READER_JWT');
  return createClient(required(env, 'SUPABASE_URL'), required(env, 'SUPABASE_ANON_KEY'), {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}

export function createWriterClient(env) {
  return createClient(required(env, 'SUPABASE_URL'), required(env, 'SUPABASE_SERVICE_ROLE_KEY'), {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}
