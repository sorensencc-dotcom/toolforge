import { createClient } from '@supabase/supabase-js';
import { createLocalEmbeddingProvider } from '../../../src/providers/index.js';

function required(env, name) {
  if (!env[name]?.trim()) throw new Error(`${name} required`);
  return env[name];
}

export function createEmbeddingProvider(env) {
  if (env.EMBEDDING_DIMENSION && env.EMBEDDING_DIMENSION !== '1536') throw new Error('Unsupported embedding configuration');
  return createLocalEmbeddingProvider({ provider: env.EMBEDDING_PROVIDER ?? 'ollama', model: required(env, 'EMBEDDING_MODEL'),
    baseUrl: env.EMBEDDING_PROVIDER === 'freellm' ? env.FREELLM_BASE_URL : env.OLLAMA_BASE_URL,
    apiKey: env.FREELLM_API_KEY });
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
