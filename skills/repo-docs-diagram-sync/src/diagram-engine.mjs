// skills/repo-docs-diagram-sync/src/diagram-engine.mjs
import fs from 'node:fs';
import path from 'node:path';

export const LAVERY_PALETTE = {
  paper: '#f5f5f5',
  ink: '#2d3142',
  muted: '#4f5d75',
  accent: '#bf4520',
};

export const DEFAULT_WIDTH = 1150;
export const DEFAULT_HEIGHT = 500;

/**
 * Scans markdown text for mermaid code blocks that are not yet embedded or need syncing.
 * @param {string} markdown
 * @returns {Array<{ index: number, fullMatch: string, title?: string, mermaidSource: string, hasEmbed: boolean }>}
 */
export function scanMarkdownForMermaid(markdown) {
  const results = [];
  const regex = /(?:!\[([^\]]*)\]\(([^)]+\.png)\)\s*\n+)?(?:<details>\s*<summary>(?:Mermaid source\.\.\.|Mermaid Source)<\/summary>\s*\n+)?```mermaid\r?\n([\s\S]*?)```(?:\s*\n+<\/details>)?/gi;
  
  let match;
  while ((match = regex.exec(markdown)) !== null) {
    const [fullMatch, existingTitle, existingPng, mermaidSource] = match;
    const hasEmbed = Boolean(existingPng);
    results.push({
      index: match.index,
      fullMatch,
      title: existingTitle || 'Architecture Diagram',
      pngPath: existingPng || null,
      mermaidSource: mermaidSource.trim(),
      hasEmbed,
    });
  }
  return results;
}

/**
 * Inspects HTML content to check if it adheres to the Cathryn Lavery standard.
 * @param {string} html
 * @returns {{ isLavery: boolean, missingTokens: string[] }}
 */
export function inspectHtmlSkin(html) {
  const missing = [];
  if (!html.includes('#f5f5f5')) missing.push('#f5f5f5');
  if (!html.includes('#2d3142')) missing.push('#2d3142');
  if (!html.includes('#4f5d75')) missing.push('#4f5d75');
  if (!html.includes('#bf4520')) missing.push('#bf4520');
  if (!/Instrument[\s+]Serif/i.test(html)) missing.push('Instrument Serif');
  if (!/Geist/i.test(html)) missing.push('Geist');

  return {
    isLavery: missing.length === 0,
    missingTokens: missing,
  };
}

/**
 * Builds standalone Cathryn Lavery compliant HTML+SVG diagram source.
 * @param {object} options
 * @returns {string}
 */
export function buildCathrynLaveryHtml({
  title = 'System Architecture',
  subtitle = 'SYSTEM SPECIFICATION • GOVERNED RUNTIME',
  badge = 'SPECIFICATION v1.0',
  width = DEFAULT_WIDTH,
  height = DEFAULT_HEIGHT,
  svgBody = '',
  mermaidSource = '',
}) {
  const safeTitle = title.replace(/"/g, '&quot;');
  const safeSubtitle = subtitle.replace(/"/g, '&quot;');

  // If svgBody is empty, generate a clean placeholder SVG frame with nodes derived from mermaidSource if available
  const contentSvg = svgBody || generateSvgFromMermaid(mermaidSource, width - 64, height - 160);

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>${safeTitle}</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Geist:wght@400;500;600;700&family=Geist+Mono:wght@400;600&family=Instrument+Serif:ital@0;1&display=swap" rel="stylesheet">
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    :root {
      --color-paper:   #f5f5f5;
      --color-ink:     #2d3142;
      --color-muted:   #4f5d75;
      --color-accent:  #bf4520;
      --font-sans:     'Geist', system-ui, sans-serif;
      --font-serif:    'Instrument Serif', serif;
      --font-mono:     'Geist Mono', ui-monospace, monospace;
    }
    body {
      font-family: var(--font-sans);
      background: var(--color-paper);
      color: var(--color-ink);
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 2.5rem 2rem;
    }
    .frame {
      max-width: ${width}px;
      width: 100%;
      background: #f5f5f5;
      border: 2px solid #4f5d75;
      padding: 32px;
      box-shadow: 6px 6px 0px #4f5d75;
    }
    .header {
      border-bottom: 2px solid #bf4520;
      padding-bottom: 16px;
      margin-bottom: 24px;
      display: flex;
      justify-content: space-between;
      align-items: flex-end;
    }
    .title-group h1 {
      font-family: var(--font-serif);
      font-size: 28px;
      font-weight: 700;
      color: var(--color-ink);
      letter-spacing: -0.5px;
    }
    .title-group p {
      font-family: var(--font-sans);
      font-size: 14px;
      color: var(--color-muted);
      text-transform: uppercase;
      letter-spacing: 1px;
      margin-top: 4px;
    }
    .badge {
      background-color: var(--color-ink);
      color: var(--color-paper);
      font-family: var(--font-mono);
      font-size: 12px;
      padding: 6px 12px;
      border-radius: 2px;
      letter-spacing: 0.5px;
    }
    svg { width: 100%; display: block; height: auto; }
    .footer-note {
      margin-top: 20px;
      padding-top: 12px;
      border-top: 1px dashed var(--color-muted);
      display: flex;
      justify-content: space-between;
      font-family: var(--font-mono);
      font-size: 11px;
      color: var(--color-muted);
    }
  </style>
</head>
<body>
  <div class="frame">
    <div class="header">
      <div class="title-group">
        <h1>${safeTitle}</h1>
        <p>${safeSubtitle}</p>
      </div>
      <div class="badge">${badge}</div>
    </div>
    <svg xmlns="http://www.w3.org/2000/svg" role="img" aria-labelledby="diag-title diag-desc" viewBox="0 0 ${width - 64} ${height - 160}">
      <title id="diag-title">${safeTitle}</title>
      <desc id="diag-desc">${safeSubtitle}</desc>
      <defs>
        <marker id="arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
          <path d="M 0 1 L 10 5 L 0 9 z" fill="#2d3142"/>
        </marker>
        <marker id="arrow-accent" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
          <path d="M 0 1 L 10 5 L 0 9 z" fill="#bf4520"/>
        </marker>
        <filter id="shadow" x="-5%" y="-5%" width="110%" height="115%">
          <feDropShadow dx="0" dy="4" stdDeviation="6" flood-color="#2d3142" flood-opacity="0.08"/>
        </filter>
      </defs>
      ${contentSvg}
    </svg>
    <div class="footer-note">
      <span>SYSTEM: ARCHITECTURE SPECIFICATION</span>
      <span>PALETTE: CATHRYN LAVERY DIAGRAM-DESIGN SKIN (#f5f5f5 / #bf4520)</span>
    </div>
  </div>
</body>
</html>`;
}

/**
 * Generates structured SVG elements representing parsed nodes from Mermaid text.
 */
export function generateSvgFromMermaid(mermaidSource, viewBoxWidth = 1086, viewBoxHeight = 340) {
  const lines = (mermaidSource || '').split('\n').map((l) => l.trim()).filter(Boolean);
  const nodeMatches = [];
  const linkMatches = [];

  function parseNodeRef(token) {
    if (!token) return null;
    const m = token.match(/^([a-zA-Z0-9_-]+)(?:\[\("?(.*?)"?\)\]|\(\["?(.*?)"?\]\)|\{"?(.*?)"?\}|\("?(.*?)"?\)|\{"?(.*?)"?\}|\["?(.*?)"?\])?$/);
    if (!m) return null;
    const id = m[1];
    const label = m[2] || m[3] || m[4] || m[5] || m[6] || m[7] || id;
    return { id, label };
  }

  for (const line of lines) {
    if (/^(graph|flowchart|subgraph|end)/i.test(line)) continue;
    
    // Match: A[...] -->|Label| B[...]
    const arrowMatch = line.match(/^([a-zA-Z0-9_-]+(?:\[\("?.*?"?\)\]|\(\["?.*?"?\]\)|\{"?.*?"?\}|\("?.*?"?\)|\{"?.*?"?\}|\["?.*?"?\])?)\s*(-->|-.->|==>)(?:\|.*?\|)?\s*([a-zA-Z0-9_-]+(?:\[\("?.*?"?\)\]|\(\["?.*?"?\]\)|\{"?.*?"?\}|\("?.*?"?\)|\{"?.*?"?\}|\["?.*?"?\])?)/);
    if (arrowMatch) {
      const src = parseNodeRef(arrowMatch[1]);
      const dst = parseNodeRef(arrowMatch[3]);
      const arrowType = arrowMatch[2];
      if (src && !nodeMatches.some((n) => n.id === src.id)) nodeMatches.push(src);
      if (dst && !nodeMatches.some((n) => n.id === dst.id)) nodeMatches.push(dst);
      if (src && dst) linkMatches.push({ srcId: src.id, dstId: dst.id, arrowType });
      continue;
    }

    // Match individual node: A["Label"] or A{"Label"} or A[("Label")] or A(["Label"])
    const single = parseNodeRef(line);
    if (single && single.label !== single.id) {
      if (!nodeMatches.some((n) => n.id === single.id)) nodeMatches.push(single);
    }
  }

  if (nodeMatches.length === 0) {
    nodeMatches.push({ id: 'core', label: 'Primary Architecture Flow' });
  }

  const nodeWidth = 200;
  const nodeHeight = 70;
  const count = nodeMatches.length;
  const totalWidth = count * nodeWidth + (count - 1) * 60;
  const startX = Math.max(30, (viewBoxWidth - totalWidth) / 2);
  const posY = Math.max(40, (viewBoxHeight - nodeHeight) / 2);

  const nodePositions = {};
  let svgNodes = '';
  nodeMatches.forEach((node, i) => {
    const x = startX + i * (nodeWidth + 60);
    const y = posY;
    nodePositions[node.id] = { cx: x + nodeWidth / 2, cy: y + nodeHeight / 2, left: x, right: x + nodeWidth };
    const isFirst = i === 0;
    const isLast = i === count - 1;
    const accentStroke = isFirst || isLast ? '#bf4520' : '#4f5d75';

    svgNodes += `
      <g class="node" transform="translate(${x}, ${y})">
        <rect width="${nodeWidth}" height="${nodeHeight}" rx="4" fill="#ffffff" stroke="${accentStroke}" stroke-width="2" filter="url(#shadow)"/>
        <text x="${nodeWidth / 2}" y="32" text-anchor="middle" font-family="'Geist', sans-serif" font-weight="600" font-size="13" fill="#2d3142">${node.label}</text>
        <text x="${nodeWidth / 2}" y="50" text-anchor="middle" font-family="'Geist Mono', monospace" font-size="10" fill="#4f5d75">NODE::${node.id.toUpperCase()}</text>
      </g>`;
  });

  let svgLinks = '';
  if (linkMatches.length > 0) {
    linkMatches.forEach((link) => {
      const src = nodePositions[link.srcId];
      const dst = nodePositions[link.dstId];
      if (src && dst) {
        const x1 = src.right;
        const y1 = src.cy;
        const x2 = dst.left;
        const y2 = dst.cy;
        svgLinks += `
        <path d="M ${x1} ${y1} L ${x2} ${y2}" stroke="#2d3142" stroke-width="2" marker-end="url(#arrow)"/>`;
      }
    });
  } else if (count > 1) {
    for (let i = 0; i < count - 1; i++) {
      const src = nodePositions[nodeMatches[i].id];
      const dst = nodePositions[nodeMatches[i + 1].id];
      const x1 = src.right;
      const y1 = src.cy;
      const x2 = dst.left;
      const y2 = dst.cy;
      svgLinks += `
      <path d="M ${x1} ${y1} L ${x2} ${y2}" stroke="#2d3142" stroke-width="2" marker-end="url(#arrow)"/>`;
    }
  }

  return `<g class="diagram-elements">${svgLinks}${svgNodes}\n    </g>`;
}

/**
 * Embeds a PNG preview above a collapsible Mermaid source block in Markdown.
 */
export function embedDiagramInMarkdown(markdownContent, { title = 'Architecture Diagram', pngRelativePath, mermaidSource }) {
  const embedBlock = `![${title}](${pngRelativePath})\n\n<details><summary>Mermaid source...</summary>\n\n\`\`\`mermaid\n${mermaidSource.trim()}\n\`\`\`\n\n</details>`;
  
  // Replace un-embedded mermaid block or existing embedded block
  const pattern = new RegExp(
    `(?:!\\[[^\\]]*\\]\\([^)]+\\)\\s*\\n+)?(?:<details>\\s*<summary>(?:Mermaid source\\.\\.\\.|Mermaid Source)<\\/summary>\\s*\\n+)?\`\`\`mermaid\\r?\\n${escapeRegExp(mermaidSource.trim())}\\r?\\n\`\`\`(?:\\s*\\n+<\\/details>)?`,
    'g'
  );

  if (pattern.test(markdownContent)) {
    return markdownContent.replace(pattern, embedBlock);
  }

  // Fallback: append embedBlock to markdownContent
  return `${markdownContent}\n\n${embedBlock}\n`;
}

function escapeRegExp(string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
