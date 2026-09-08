import fs from 'node:fs';
import path from 'node:path';
import { renderDiagram } from './render-diagram.mjs';

function template({ title, subtitle, badge, width = 1100, height = 480, svgContent }) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>${title}</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@500;600;700&family=Geist+Mono:wght@400;600&family=Playfair+Display:ital,wght@0,600;0,700;1,400&display=swap" rel="stylesheet">
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    :root {
      --color-paper:   #f2ece2;
      --color-ink:     #2c2420;
      --color-muted:   #5c5349;
      --color-accent:  #c4501a;
      --font-sans:     'Barlow Condensed', system-ui, sans-serif;
      --font-serif:    'Playfair Display', serif;
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
      background: #f2ece2;
      border: 2px solid #5c5349;
      padding: 32px;
      box-shadow: 6px 6px 0px #5c5349;
    }
    .header {
      border-bottom: 2px solid #c4501a;
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
        <h1>${title}</h1>
        <p>${subtitle}</p>
      </div>
      <div class="badge">${badge}</div>
    </div>
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}">
      <defs>
        <marker id="arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
          <path d="M 0 1 L 10 5 L 0 9 z" fill="#2c2420"/>
        </marker>
        <marker id="arrow-accent" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
          <path d="M 0 1 L 10 5 L 0 9 z" fill="#c4501a"/>
        </marker>
        <filter id="shadow" x="-5%" y="-5%" width="110%" height="115%">
          <feDropShadow dx="0" dy="4" stdDeviation="6" flood-color="#2c2420" flood-opacity="0.08"/>
        </filter>
      </defs>
      ${svgContent}
    </svg>
    <div class="footer-note">
      <span>SYSTEM: KB-SYNC ARCHITECTURE SPECIFICATION</span>
      <span>PALETTE: CATHRYN LAVERY WARM PAPER (#F2ECE2 / #C4501A)</span>
    </div>
  </div>
</body>
</html>`;
}

// 1. trm-closed-loop-research
const trmClosedLoopSvg = `
  <!-- 4 stages horizontal -->
  <g filter="url(#shadow)">
    <!-- Stage 1 -->
    <rect x="30" y="30" width="220" height="260" rx="6" fill="#fff" stroke="#5c5349" stroke-width="1.5"/>
    <rect x="30" y="30" width="220" height="38" rx="6" fill="#2c2420"/>
    <rect x="30" y="56" width="220" height="12" fill="#2c2420"/>
    <text x="45" y="55" font-family="'Barlow Condensed', sans-serif" font-size="15" font-weight="700" fill="#f2ece2">1. GAP DETECTION</text>
    <text x="45" y="95" font-family="'Barlow Condensed', sans-serif" font-size="15" font-weight="600" fill="#2c2420">NotebookLM Question Mining</text>
    <text x="45" y="120" font-family="'Geist Mono', monospace" font-size="11.5" fill="#5c5349">• Audio & Text Ingest</text>
    <text x="45" y="142" font-family="'Geist Mono', monospace" font-size="11.5" fill="#5c5349">• Ambiguity Extraction</text>
    <text x="45" y="164" font-family="'Geist Mono', monospace" font-size="11.5" fill="#5c5349">• trm-research-gaps.md</text>
    <rect x="45" y="190" width="190" height="40" rx="4" fill="#f8f5f0" stroke="#c4501a" stroke-width="1"/>
    <text x="55" y="214" font-family="'Geist Mono', monospace" font-size="11" fill="#c4501a">- [ ] [GAP-XX] Logging</text>

    <!-- Arrow 1 to 2 -->
    <path d="M 250 160 L 290 160" fill="none" stroke="#2c2420" stroke-width="2" marker-end="url(#arrow)"/>

    <!-- Stage 2 -->
    <rect x="295" y="30" width="220" height="260" rx="6" fill="#fff" stroke="#c4501a" stroke-width="2"/>
    <rect x="295" y="30" width="220" height="38" rx="6" fill="#c4501a"/>
    <rect x="295" y="56" width="220" height="12" fill="#c4501a"/>
    <text x="310" y="55" font-family="'Barlow Condensed', sans-serif" font-size="15" font-weight="700" fill="#f2ece2">2. AUTOMATED TRIAGE</text>
    <text x="310" y="95" font-family="'Barlow Condensed', sans-serif" font-size="15" font-weight="600" fill="#2c2420">Context Cache Engine</text>
    <text x="310" y="120" font-family="'Geist Mono', monospace" font-size="11.5" fill="#5c5349">• Query Expansion (Ollama)</text>
    <text x="310" y="142" font-family="'Geist Mono', monospace" font-size="11.5" fill="#5c5349">• SQLite FTS5 BM25 Search</text>
    <text x="310" y="164" font-family="'Geist Mono', monospace" font-size="11.5" fill="#5c5349">• Dense Vector Match (RRF)</text>
    <text x="310" y="186" font-family="'Geist Mono', monospace" font-size="11.5" fill="#5c5349">• Graft AST Grounding</text>

    <!-- Arrow 2 to 3 -->
    <path d="M 515 160 L 555 160" fill="none" stroke="#2c2420" stroke-width="2" marker-end="url(#arrow)"/>

    <!-- Stage 3 -->
    <rect x="560" y="30" width="220" height="260" rx="6" fill="#fff" stroke="#5c5349" stroke-width="1.5"/>
    <rect x="560" y="30" width="220" height="38" rx="6" fill="#2c2420"/>
    <rect x="560" y="56" width="220" height="12" fill="#2c2420"/>
    <text x="575" y="55" font-family="'Barlow Condensed', sans-serif" font-size="15" font-weight="700" fill="#f2ece2">3. RFC SYNTHESIS</text>
    <text x="575" y="95" font-family="'Barlow Condensed', sans-serif" font-size="15" font-weight="600" fill="#2c2420">Materialization & Decisions</text>
    <text x="575" y="120" font-family="'Geist Mono', monospace" font-size="11.5" fill="#5c5349">• wiki/research/rfc-gap-*.md</text>
    <text x="575" y="142" font-family="'Geist Mono', monospace" font-size="11.5" fill="#5c5349">• Primary Citation Tables</text>
    <text x="575" y="164" font-family="'Geist Mono', monospace" font-size="11.5" fill="#5c5349">• Mutates gaps: - [/]</text>
    <text x="575" y="186" font-family="'Geist Mono', monospace" font-size="11.5" fill="#5c5349">• Backlink Propagation</text>

    <!-- Arrow 3 to 4 -->
    <path d="M 780 160 L 820 160" fill="none" stroke="#2c2420" stroke-width="2" marker-end="url(#arrow)"/>

    <!-- Stage 4 -->
    <rect x="825" y="30" width="220" height="260" rx="6" fill="#fff" stroke="#5c5349" stroke-width="1.5"/>
    <rect x="825" y="30" width="220" height="38" rx="6" fill="#2c2420"/>
    <rect x="825" y="56" width="220" height="12" fill="#2c2420"/>
    <text x="840" y="55" font-family="'Barlow Condensed', sans-serif" font-size="15" font-weight="700" fill="#f2ece2">4. WIKI PUBLICATION</text>
    <text x="840" y="95" font-family="'Barlow Condensed', sans-serif" font-size="15" font-weight="600" fill="#2c2420">Knowledge Base Sync</text>
    <text x="840" y="120" font-family="'Geist Mono', monospace" font-size="11.5" fill="#5c5349">• Home.md & _Sidebar.md</text>
    <text x="840" y="142" font-family="'Geist Mono', monospace" font-size="11.5" fill="#5c5349">• Local Cache Re-Index</text>
    <text x="840" y="164" font-family="'Geist Mono', monospace" font-size="11.5" fill="#5c5349">• Remote GitHub Wiki Push</text>
    <text x="840" y="186" font-family="'Geist Mono', monospace" font-size="11.5" fill="#5c5349">• MCP Server Immediate Recall</text>
  </g>
`;

// Write HTML and render PNGs
const wikiDir = 'C:\\dev\\_kb-sync-wiki-check';

fs.writeFileSync(path.join(wikiDir, 'trm-closed-loop-research.html'), template({
  title: 'TRM Closed-Loop Research & Synthesis Lifecycle',
  subtitle: 'Autonomous Gap Detection • Context Cross-Referencing • RFC Materialization',
  badge: 'SPEC v1.2.0',
  width: 1075,
  height: 330,
  svgContent: trmClosedLoopSvg
}));

renderDiagram(path.join(wikiDir, 'trm-closed-loop-research.html'), path.join(wikiDir, 'trm-closed-loop-research.png'), 1180, 540);
console.log('Generated trm-closed-loop-research');
