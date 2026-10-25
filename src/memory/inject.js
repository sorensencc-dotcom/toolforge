import { MEMORY_KINDS } from './entry.js';

const DEFAULT_MAX_TOKENS = 1500;
const CHARS_PER_TOKEN = 4;
const BLOCK_OPEN = '<active-memory>';
const BLOCK_CLOSE = '</active-memory>';

const STOPWORDS = new Set([
  'a', 'an', 'and', 'are', 'as', 'at', 'be', 'but', 'by', 'can', 'do', 'does', 'for', 'from', 'has', 'have',
  'how', 'i', 'if', 'in', 'into', 'is', 'it', 'its', 'me', 'my', 'not', 'of', 'on', 'or', 'our', 'should',
  'so', 'that', 'the', 'their', 'then', 'there', 'these', 'this', 'to', 'was', 'we', 'were', 'what', 'when',
  'where', 'which', 'who', 'why', 'will', 'with', 'would', 'you', 'your',
]);

function estimateTokens(charCount) {
  return Math.ceil(charCount / CHARS_PER_TOKEN);
}

function terms(text) {
  const words = text.toLowerCase().match(/[\p{L}\p{N}]+/gu) ?? [];
  return new Set(words.filter((word) => !STOPWORDS.has(word)));
}

function compareStrings(a, b) {
  if (a === b) return 0;
  return a < b ? -1 : 1;
}

function rank(entries, query) {
  const queryTerms = [...terms(query)];
  return entries
    .map((entry) => {
      const entryTerms = terms(`${entry.text} ${entry.tags.join(' ')}`);
      const overlap = queryTerms.filter((term) => entryTerms.has(term)).length;
      return { entry, overlap, score: overlap + MEMORY_KINDS[entry.kind].rankBoost };
    })
    .filter(({ overlap }) => overlap > 0)
    .sort((a, b) =>
      b.score - a.score
      || compareStrings(b.entry.updatedAt, a.entry.updatedAt)
      || compareStrings(a.entry.id, b.entry.id))
    .map(({ entry }) => entry);
}

function renderLine(entry) {
  const text = entry.text
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/<(?=\s*\/?\s*active-memory)/gi, '&lt;');
  return `- [${entry.kind}] ${text}`;
}

function pack(entries, query, maxTokens) {
  let blockChars = BLOCK_OPEN.length + 1 + BLOCK_CLOSE.length;
  const packed = [];
  for (const entry of rank(entries, query)) {
    const line = renderLine(entry);
    if (estimateTokens(blockChars + line.length + 1) <= maxTokens) {
      blockChars += line.length + 1;
      packed.push({ entry, line });
    }
  }
  return packed;
}

export function selectMemoryForPrompt(entries, query, { maxTokens = DEFAULT_MAX_TOKENS } = {}) {
  return pack(entries, query, maxTokens).map(({ entry }) => entry);
}

export function injectActiveMemory(systemPrompt, entries, query, { maxTokens = DEFAULT_MAX_TOKENS } = {}) {
  const packed = pack(entries, query, maxTokens);
  if (packed.length === 0) return systemPrompt;
  const block = [BLOCK_OPEN, ...packed.map(({ line }) => line), BLOCK_CLOSE].join('\n');
  return systemPrompt ? `${systemPrompt}\n\n${block}` : block;
}
