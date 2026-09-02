import { describe, it, expect } from 'vitest';
import { parseMarkdown } from '../src/parser';
import { SuppressionRegistry } from '../src/suppressions';

describe('AST Parser & AST Node Inspection Suite', () => {
  it('exempts fenced code blocks from all prose checks', () => {
    const doc = `
# Title
\`\`\`bash
Certainly! Here is code essentially.
We recommend running this command.
\`\`\`
`;
    const res = parseMarkdown(doc);
    expect(res.proseNodes.some((n) => n.text.includes('Certainly!'))).toBe(false);
    expect(res.proseNodes.some((n) => n.text.includes('We recommend'))).toBe(false);
  });

  it('exempts inline code spans from prose checks', () => {
    const doc = `Here is \`essentially\` inline code with \`Certainly!\`.`;
    const res = parseMarkdown(doc);
    expect(res.proseNodes.length).toBe(1);
    expect(res.proseNodes[0].text).toBe('Here is  inline code with .');
  });

  it('exempts GFM tables from prose checks', () => {
    const doc = `
| Header 1 | Header 2 |
|---|---|
| Certainly | delve seamlessly |
| We recommend | vastly superior |
`;
    const res = parseMarkdown(doc);
    expect(res.proseNodes.length).toBe(0);
  });

  it('exempts YAML frontmatter headers from prose checks', () => {
    const doc = `---
title: Certainly A Great Title
description: We recommend this essentially.
---
# Main Content
`;
    const res = parseMarkdown(doc);
    expect(res.proseNodes.some((n) => n.text.includes('Certainly A Great Title'))).toBe(false);
  });

  it('exempts TOML frontmatter headers from prose checks', () => {
    const doc = `+++
title = "Certainly A Great Title"
+++
# Main Content
`;
    const res = parseMarkdown(doc);
    expect(res.proseNodes.some((n) => n.text.includes('Certainly A Great Title'))).toBe(false);
  });

  it('extracts link nodes and inner link text accurately', () => {
    const doc = `Click [here](https://example.com) for details or visit [API Documentation](https://api.example.com).`;
    const res = parseMarkdown(doc);
    expect(res.linkNodes.length).toBe(2);
    expect(res.linkNodes[0].text).toBe('here');
    expect(res.linkNodes[0].url).toBe('https://example.com');
    expect(res.linkNodes[1].text).toBe('API Documentation');
  });

  it('extracts suppression HTML comments', () => {
    const doc = `<!-- heuristics-disable ban-filler-adverbs author="soren" reason="Direct citation" until="2099-01-01" -->`;
    const res = parseMarkdown(doc);
    expect(res.comments.length).toBe(1);
    expect(res.comments[0].value).toContain('heuristics-disable');
  });

  it('preserves line and column location metadata in parsed nodes', () => {
    const doc = `Line 1\n\nLine 3 Paragraph`;
    const res = parseMarkdown(doc);
    expect(res.proseNodes[0].line).toBe(1);
    expect(res.proseNodes[1].line).toBe(3);
  });
});
