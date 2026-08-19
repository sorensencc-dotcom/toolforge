import { unified } from 'unified';
import remarkParse from 'remark-parse';
import remarkGfm from 'remark-gfm';
import remarkFrontmatter from 'remark-frontmatter';
import { visit } from 'unist-util-visit';

export interface ProseNode {
  type: string;
  text: string;
  line: number;
  column: number;
  endLine: number;
  endColumn: number;
  rawNode: any;
}

export interface LinkMetadata {
  text: string;
  url: string;
  line: number;
  column: number;
  endLine: number;
  endColumn: number;
}

export interface CommentDirectiveNode {
  value: string;
  line: number;
  column: number;
}

export interface ParsedMarkdown {
  ast: any;
  proseNodes: ProseNode[];
  linkNodes: LinkMetadata[];
  comments: CommentDirectiveNode[];
}

export function parseMarkdown(content: string): ParsedMarkdown {
  const processor = unified()
    .use(remarkParse)
    .use(remarkFrontmatter, ['yaml', 'toml'])
    .use(remarkGfm);

  const ast = processor.parse(content);
  const proseNodes: ProseNode[] = [];
  const linkNodes: LinkMetadata[] = [];
  const comments: CommentDirectiveNode[] = [];

  visit(ast, (node: any) => {
    // Exempt nodes: code blocks, inlineCode, tables, yaml frontmatter
    if (
      node.type === 'code' ||
      node.type === 'inlineCode' ||
      node.type === 'table' ||
      node.type === 'tableRow' ||
      node.type === 'tableCell' ||
      node.type === 'yaml' ||
      node.type === 'toml'
    ) {
      return;
    }

    // Inspect HTML comments
    if (node.type === 'html') {
      const match = node.value.match(/^<!--\s*(.*?)\s*-->$/s);
      if (match) {
        comments.push({
          value: match[1].trim(),
          line: node.position?.start?.line ?? 1,
          column: node.position?.start?.column ?? 1,
        });
      }
      return;
    }

    // Inspect Links
    if (node.type === 'link') {
      let linkText = '';
      if (node.children) {
        linkText = node.children.map((c: any) => c.value ?? '').join('');
      }
      linkNodes.push({
        text: linkText.trim(),
        url: node.url ?? '',
        line: node.position?.start?.line ?? 1,
        column: node.position?.start?.column ?? 1,
        endLine: node.position?.end?.line ?? 1,
        endColumn: node.position?.end?.column ?? 1,
      });
      return;
    }

    // Prose nodes: paragraph text or heading text
    if (node.type === 'paragraph' || node.type === 'heading') {
      let fullText = '';
      visit(node, (child: any) => {
        if (child.type === 'text') {
          fullText += child.value;
        }
      });

      if (fullText.trim().length > 0) {
        proseNodes.push({
          type: node.type,
          text: fullText,
          line: node.position?.start?.line ?? 1,
          column: node.position?.start?.column ?? 1,
          endLine: node.position?.end?.line ?? 1,
          endColumn: node.position?.end?.column ?? 1,
          rawNode: node,
        });
      }
    }
  });

  return { ast, proseNodes, linkNodes, comments };
}
