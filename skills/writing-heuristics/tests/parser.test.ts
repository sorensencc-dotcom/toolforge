import { describe, it, expect } from 'vitest';
import { parseMarkdown } from '../src/parser';
import { SuppressionRegistry } from '../src/suppressions';

describe('AST Parser & Exemptions', () => {
  it('exempts fenced code blocks and inline code from prose checks', () => {
    const doc = `
# Title
\`\`\`bash
Certainly! Here is code
\`\`\`
Here is \`essentially\` inline code.
`;
    const res = parseMarkdown(doc);
    expect(res.proseNodes.some((n) => n.text.includes('Here is code'))).toBe(false);
  });

  it('exempts GFM tables from prose checks', () => {
    const doc = `
| Col1 | Col2 |
|---|---|
| Certainly | delve |
`;
    const res = parseMarkdown(doc);
    expect(res.proseNodes.length).toBe(0);
  });

  it('parses directive suppressions correctly', () => {
    const doc = `<!-- heuristics-disable ban-filler-adverbs author="soren" reason="test" until="2099-01-01" -->`;
    const res = parseMarkdown(doc);
    const reg = new SuppressionRegistry(res.comments);
    expect(reg.isSuppressed('ban-filler-adverbs', 1)).toBe(true);
  });
});
