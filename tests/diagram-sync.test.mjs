import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  scanMarkdownForMermaid,
  inspectHtmlSkin,
  buildCathrynLaveryHtml,
  embedDiagramInMarkdown,
  generateSvgFromMermaid,
  LAVERY_PALETTE,
} from '../skills/repo-docs-diagram-sync/src/diagram-engine.mjs';
import { syncDiagramsInFile, parseArgs, runBenchmark } from '../scripts/diagram-sync.mjs';

test('scanMarkdownForMermaid: identifies un-embedded and embedded mermaid blocks', () => {
  const sample = `# Title
Some content here.

\`\`\`mermaid
flowchart TD
  A["Start"] --> B["End"]
\`\`\`

More content.

![Already Embedded](already.png)

<details><summary>Mermaid source...</summary>

\`\`\`mermaid
flowchart LR
  C --> D
\`\`\`

</details>
`;

  const diagrams = scanMarkdownForMermaid(sample);
  assert.equal(diagrams.length, 2);
  assert.equal(diagrams[0].hasEmbed, false);
  assert.equal(diagrams[0].mermaidSource.includes('Start'), true);
  assert.equal(diagrams[1].hasEmbed, true);
  assert.equal(diagrams[1].pngPath, 'already.png');
});

test('inspectHtmlSkin: validates Cathryn Lavery tokens and flags legacy skins', () => {
  const compliantHtml = `
    <html>
      <head>
        <link href="https://fonts.googleapis.com/css2?family=Geist&family=Instrument+Serif">
      </head>
      <body>
        <div style="background: #f5f5f5; color: #2d3142; border: 1px solid #4f5d75; stroke: #bf4520;"></div>
      </body>
    </html>
  `;
  const compliantCheck = inspectHtmlSkin(compliantHtml);
  assert.equal(compliantCheck.isLavery, true);
  assert.equal(compliantCheck.missingTokens.length, 0);

  const legacyHtml = `
    <html>
      <body style="background: #ffffff; color: #000000;">
        <h1>Old Diagram</h1>
      </body>
    </html>
  `;
  const legacyCheck = inspectHtmlSkin(legacyHtml);
  assert.equal(legacyCheck.isLavery, false);
  assert.ok(legacyCheck.missingTokens.includes('#f5f5f5'));
  assert.ok(legacyCheck.missingTokens.includes('#bf4520'));
});

test('buildCathrynLaveryHtml: injects all palette tokens, fonts, and SVG metadata', () => {
  const html = buildCathrynLaveryHtml({
    title: 'Test Architecture',
    subtitle: 'CORE SUBSYSTEM',
    badge: 'SPEC v2.0',
    mermaidSource: 'graph TD\n  A["Source"] --> B["Sink"]',
  });

  assert.ok(html.includes('#f5f5f5'), 'Includes paper token');
  assert.ok(html.includes('#2d3142'), 'Includes ink token');
  assert.ok(html.includes('#4f5d75'), 'Includes muted token');
  assert.ok(html.includes('#bf4520'), 'Includes accent token');
  assert.ok(html.includes('Instrument Serif'), 'Includes Instrument Serif header font');
  assert.ok(html.includes('Geist'), 'Includes Geist sans font');
  assert.ok(html.includes('role="img"'), 'Includes accessible SVG role');
  assert.ok(html.includes('aria-labelledby'), 'Includes accessibility label reference');
  assert.ok(html.includes('Test Architecture'), 'Renders title');
});

test('generateSvgFromMermaid: parses nodes and generates connector paths', () => {
  const mermaid = `flowchart LR
    Ingest["Ingestion Worker"] --> State[("Database Store")]
  `;
  const svg = generateSvgFromMermaid(mermaid, 1000, 300);
  assert.ok(svg.includes('Ingestion Worker'));
  assert.ok(svg.includes('Database Store'));
  assert.ok(svg.includes('<path d="M'));
});

test('embedDiagramInMarkdown: places PNG embed above collapsible details block', () => {
  const original = `# Spec\n\n\`\`\`mermaid\nflowchart TD\n  X --> Y\n\`\`\`\n`;
  const embedded = embedDiagramInMarkdown(original, {
    title: 'Component Flow',
    pngRelativePath: 'component-flow.png',
    mermaidSource: 'flowchart TD\n  X --> Y',
  });

  assert.ok(embedded.includes('![Component Flow](component-flow.png)'));
  assert.ok(embedded.includes('<details><summary>Mermaid source...</summary>'));
  assert.ok(embedded.includes('```mermaid\nflowchart TD\n  X --> Y\n```'));
  assert.ok(embedded.includes('</details>'));
});

test('syncDiagramsInFile: scans, generates artifacts and updates markdown cleanly', () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'diag-sync-test-'));
  const testFile = path.join(tempDir, 'architecture.md');
  const markdown = `# Subsystem Spec\n\n\`\`\`mermaid\nflowchart LR\n  Alpha --> Beta\n\`\`\`\n`;
  fs.writeFileSync(testFile, markdown, 'utf8');

  // Dry run: should find diagram but not mutate file
  const dryRes = syncDiagramsInFile(testFile, { dryRun: true, renderPng: false });
  assert.equal(dryRes.diagramsFound, 1);
  assert.equal(dryRes.modified, true);
  assert.equal(fs.readFileSync(testFile, 'utf8'), markdown);

  // Real run (renderPng false to avoid launching chrome during quick unit test):
  const realRes = syncDiagramsInFile(testFile, { dryRun: false, renderPng: false });
  assert.equal(realRes.diagramsFound, 1);
  const updated = fs.readFileSync(testFile, 'utf8');
  assert.ok(updated.includes('![Architecture Diagram](architecture.png)'));
  assert.ok(fs.existsSync(path.join(tempDir, 'architecture.html')));

  // Idempotency: second run should perform zero changes
  const secondRes = syncDiagramsInFile(testFile, { dryRun: false, renderPng: false });
  assert.equal(secondRes.diagramsFound, 1);
  assert.equal(secondRes.modified, false);

  fs.rmSync(tempDir, { recursive: true, force: true });
});

test('parseArgs & runBenchmark: parses CLI flags and executes performance probe', () => {
  const parsed = parseArgs(['--dry-run', '--fix', '--benchmark', '--path=docs']);
  assert.equal(parsed.dryRun, true);
  assert.equal(parsed.fix, true);
  assert.equal(parsed.benchmark, true);
  assert.ok(parsed.targetPath.endsWith('docs'));

  const elapsed = runBenchmark();
  assert.ok(typeof elapsed === 'number');
  assert.ok(elapsed < 4500, `Benchmark elapsed (${elapsed}ms) must be under 4500ms`);
});
