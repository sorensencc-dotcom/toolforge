import { Lexer } from 'marked';

export const CHUNKING_VERSION = 'markdown-context-v1';

export function chunkResearchMarkdown(content) {
  const headings = [];
  const chunks = [];
  for (const token of Lexer.lex(content, { gfm: true })) {
    if (token.type === 'heading') {
      headings.length = token.depth;
      headings[token.depth - 1] = token.raw.trim();
      continue;
    }
    if (token.type === 'space' || token.type === 'hr') continue;
    const body = token.raw.trim();
    if (!body) continue;
    const context = headings.filter(Boolean).join('\n');
    const chunk = context ? `${context}\n\n${body}` : body;
    if (chunk.length > 8000) throw new Error('Markdown block with heading context exceeds 8000 characters; split source block');
    chunks.push(chunk);
  }
  return chunks;
}
