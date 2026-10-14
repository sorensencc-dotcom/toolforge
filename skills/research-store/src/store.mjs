export const PROJECTS = ['CIC', 'RewriteLabs', 'other'];
export const STATUSES = ['VERIFIED', 'INFERRED', 'UNKNOWN', 'NEEDS_REVIEW'];

export function validateEmbeddings(vectors, count) {
  if (!Array.isArray(vectors) || vectors.length !== count || vectors.some(vector =>
    !Array.isArray(vector) || vector.length !== 1536 || !vector.every(Number.isFinite) || !vector.some(value => value !== 0))) {
    throw new Error('Invalid embedding response');
  }
  return vectors;
}

export async function replaceDocument(supabase, document, chunks, embed) {
  const embeddings = [];
  for (let offset = 0; offset < chunks.length; offset += 16) {
    const batch = chunks.slice(offset, offset + 16);
    embeddings.push(...validateEmbeddings(await embed(batch), batch.length));
  }
  if (chunks.length && (typeof embed.identity !== 'string' || !embed.identity)) throw new Error('Embedding identity required before publishing vectors');
  const identity = embed.identity ?? null;
  const items = chunks.map((content, chunk_index) => ({
    project: document.project, content, chunk_index, embedding: embeddings[chunk_index],
    status: document.metadata?.status ?? 'UNKNOWN', confidence: document.metadata?.confidence ?? null,
    token_count: Math.ceil(content.length / 4),
    metadata: { content_hash: document.content_hash, git_path: document.git_path, tags: document.metadata?.tags ?? [], embedding_identity: identity },
  }));
  const { data, error } = await supabase.rpc('replace_research_document', {
    p_document: { ...document, metadata: { ...document.metadata, embedding_identity: identity } }, p_items: items,
  });
  if (error || typeof data !== 'string') throw new Error('Document replacement failed');
  return data;
}
