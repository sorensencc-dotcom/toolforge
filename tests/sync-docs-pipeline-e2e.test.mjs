import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import {
  discoverWorkflows,
  auditWorkflowDocumentation,
  WORKFLOW_TYPES,
} from '../skills/repo-docs-diagram-sync/src/workflow-recon.mjs';
import {
  generateMermaidForWorkflow,
  generateDocumentationForWorkflow,
  materializeWorkflowDocumentation,
} from '../skills/repo-docs-diagram-sync/src/doc-generator.mjs';
import {
  scanMarkdownForMermaid,
  inspectHtmlSkin,
  buildCathrynLaveryHtml,
  embedDiagramInMarkdown,
  generateSvgFromMermaid,
} from '../skills/repo-docs-diagram-sync/src/diagram-engine.mjs';
import {
  auditMarkdownText,
  HEURISTIC_RULES,
} from '../skills/repo-docs-diagram-sync/src/docs-synthesizer.mjs';
import { verifyDiagramParity } from '../scripts/diagram-sync.mjs';

test('Generated workflow documentation satisfies all writing heuristics with zero violations', () => {
  const workflow = {
    id: 'data-synchronizer',
    name: 'Data synchronizer daemon',
    description: 'Periodically synchronizes distributed state partitions.',
    sourceFile: 'scripts/sync-partitions.mjs',
    stages: ['Validate Inputs', 'Query Partitions', 'Commit Records'],
  };

  const doc = generateDocumentationForWorkflow(workflow);
  const violations = auditMarkdownText(doc, 'script-sync-partitions.md');
  assert.equal(violations.length, 0, `Generated documentation must have 0 style violations, found: ${JSON.stringify(violations)}`);
});

test('Stale documentation audit: accurately distinguishes fresh from out-of-date workflow docs', async () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'stale-recon-test-'));
  const scriptsDir = path.join(tempDir, 'scripts');
  const docsDir = path.join(tempDir, 'docs', 'workflows');
  fs.mkdirSync(scriptsDir, { recursive: true });
  fs.mkdirSync(docsDir, { recursive: true });

  const scriptPath = path.join(scriptsDir, 'export-metrics.mjs');
  const docPath = path.join(docsDir, 'script-export-metrics.md');

  // Case 1: Doc written first, script updated after (stale doc)
  fs.writeFileSync(docPath, '# Script Workflow: export-metrics.mjs\nDetails here.', 'utf8');
  await new Promise((r) => setTimeout(r, 60));
  fs.writeFileSync(scriptPath, '// Updated metrics export logic\nconsole.log("v2");', 'utf8');

  const workflow = {
    id: 'script-export-metrics',
    name: 'Script Workflow: export-metrics.mjs',
    type: 'script',
    sourceFile: 'scripts/export-metrics.mjs',
  };

  let audited = auditWorkflowDocumentation(tempDir, [workflow]);
  assert.equal(audited[0].isDocumented, true);
  assert.equal(audited[0].needsUpdate, true, 'Doc older than script must be flagged as needsUpdate');

  // Case 2: Doc updated after script (fresh doc)
  await new Promise((r) => setTimeout(r, 60));
  fs.writeFileSync(docPath, '# Script Workflow: export-metrics.mjs\nUpdated details.', 'utf8');

  audited = auditWorkflowDocumentation(tempDir, [workflow]);
  assert.equal(audited[0].isDocumented, true);
  assert.equal(audited[0].needsUpdate, false, 'Doc newer than script must not be flagged as needsUpdate');

  fs.rmSync(tempDir, { recursive: true, force: true });
});

test('Diagram engine handles multiple Mermaid diagrams within a single markdown document', () => {
  const markdown = `# Complex Subsystem

## Ingestion flow

\`\`\`mermaid
flowchart TD
  A["Client"] --> B["Gateway"]
\`\`\`

## Storage flow

\`\`\`mermaid
flowchart LR
  C["Buffer"] --> D["Disk"]
\`\`\`
`;

  const diagrams = scanMarkdownForMermaid(markdown);
  assert.equal(diagrams.length, 2, 'Should detect both mermaid blocks');
  assert.equal(diagrams[0].hasEmbed, false);
  assert.equal(diagrams[1].hasEmbed, false);

  // Embed first diagram
  const step1 = embedDiagramInMarkdown(markdown, {
    title: 'Ingestion Flow',
    pngRelativePath: 'ingestion-flow.png',
    mermaidSource: diagrams[0].mermaidSource,
  });
  assert.ok(step1.includes('![Ingestion Flow](ingestion-flow.png)'));
  assert.ok(step1.includes('flowchart LR\n  C["Buffer"] --> D["Disk"]'));

  // Embed second diagram
  const step2 = embedDiagramInMarkdown(step1, {
    title: 'Storage Flow',
    pngRelativePath: 'storage-flow.png',
    mermaidSource: diagrams[1].mermaidSource,
  });
  assert.ok(step2.includes('![Storage Flow](storage-flow.png)'));
  assert.ok(step2.includes('![Ingestion Flow](ingestion-flow.png)'));
});

test('Mermaid SVG generator handles complex nodes, subgraphs, and shapes', () => {
  const complexMermaid = `flowchart TD
    subgraph Pipeline
      A["Worker (Primary)"] --> B{"Decision?"}
      B -->|Yes| C[("Durable DB")]
      B -->|No| D(["Abort Handler"])
    end
  `;

  const svg = generateSvgFromMermaid(complexMermaid, 1200, 400);
  assert.ok(svg.includes('Worker (Primary)'), 'Contains node with parentheses');
  assert.ok(svg.includes('Decision?'), 'Contains decision diamond label');
  assert.ok(svg.includes('Durable DB'), 'Contains database cylinder label');
  const html = buildCathrynLaveryHtml({ title: 'Pipeline Flow', mermaidSource: complexMermaid });
  assert.ok(html.includes('role="img"'), 'Contains SVG accessibility role');
});

test('Writing heuristics: enforces Oxford commas on 3+ item lists but ignores 2-item lists', () => {
  const twoItemList = 'The system supports red and blue themes.';
  const violationsTwo = auditMarkdownText(twoItemList, 'test.md');
  assert.ok(!violationsTwo.some((v) => v.rule === HEURISTIC_RULES.SERIAL_COMMA), 'Two-item list should not trigger Oxford comma flag');

  const threeItemListWithoutComma = 'The system supports red, blue and green themes.';
  const violationsThree = auditMarkdownText(threeItemListWithoutComma, 'test.md');
  assert.ok(violationsThree.some((v) => v.rule === HEURISTIC_RULES.SERIAL_COMMA), 'Three-item list without Oxford comma must be flagged');

  const threeItemListWithComma = 'The system supports red, blue, and green themes.';
  const violationsThreeValid = auditMarkdownText(threeItemListWithComma, 'test.md');
  assert.ok(!violationsThreeValid.some((v) => v.rule === HEURISTIC_RULES.SERIAL_COMMA), 'Three-item list with Oxford comma must pass');
});

test('Writing heuristics: expired suppression directives do not silence violations', () => {
  const expiredMarkdown = `
<!-- heuristics-disable ban-throat-clearing author="dev" reason="Temporary exemption" until="2021-01-01" -->
Certainly! This section explains the database architecture.
<!-- heuristics-enable ban-throat-clearing -->
  `;

  const violations = auditMarkdownText(expiredMarkdown, 'test.md');
  assert.ok(violations.some((v) => v.rule === HEURISTIC_RULES.THROAT_CLEARING), 'Expired directive must not silence violation');
});

test('End-to-end pipeline execution via PowerShell: dry-run guarantees zero disk mutation', () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'pipeline-dryrun-'));
  const scriptsDir = path.join(tempDir, 'scripts');
  fs.mkdirSync(scriptsDir, { recursive: true });

  const scriptFile = path.join(scriptsDir, 'automated-backup.mjs');
  fs.writeFileSync(scriptFile, '// Automated backup task\nconsole.log("backup");', 'utf8');

  // Execute pipeline script with -DryRun targeting tempDir
  const scriptPath = path.resolve('scripts/sync-docs-and-diagrams.ps1');
  const output = execFileSync(
    'pwsh',
    ['-NoProfile', '-File', scriptPath, '-Path', tempDir, '-DryRun'],
    { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] }
  );

  assert.ok(output.includes('WORKFLOW_RECON_OK'));
  assert.ok(output.includes('DIAGRAM_SYNC_OK'));
  assert.ok(output.includes('DOCS_SYNTHESIZER_OK'));

  // Ensure docs/workflows was NOT created during dry run
  assert.equal(fs.existsSync(path.join(tempDir, 'docs', 'workflows')), false, 'Dry run must not create docs directory');

  fs.rmSync(tempDir, { recursive: true, force: true });
});

test('End-to-end pipeline execution via PowerShell: -GenerateWorkflows generates specs and visual parity passes', () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'pipeline-gen-'));
  const scriptsDir = path.join(tempDir, 'scripts');
  fs.mkdirSync(scriptsDir, { recursive: true });

  const scriptFile = path.join(scriptsDir, 'worker-daemon.mjs');
  fs.writeFileSync(scriptFile, '// Standalone daemon\nconsole.log("running");', 'utf8');

  const scriptPath = path.resolve('scripts/sync-docs-and-diagrams.ps1');
  const output = execFileSync(
    'pwsh',
    ['-NoProfile', '-File', scriptPath, '-Path', tempDir, '-GenerateWorkflows', '-Fix'],
    { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] }
  );

  assert.ok(output.includes('Successfully generated 1 workflow documentation and diagram suites.'));
  assert.ok(fs.existsSync(path.join(tempDir, 'docs', 'workflows', 'script-worker-daemon.md')));
  assert.ok(fs.existsSync(path.join(tempDir, 'docs', 'workflows', 'script-worker-daemon.html')));
  assert.ok(fs.existsSync(path.join(tempDir, 'docs', 'workflows', 'script-worker-daemon.png')));

  // Output outside the repo has no manifest entries, so the gate rejects it (no mtime fallback).
  fs.writeFileSync(path.join(tempDir, '.diagram-manifest.json'), '{}\n', 'utf8');
  assert.equal(verifyDiagramParity(tempDir).valid, false, 'unrecorded pairs must fail parity');
  // The documented way to record freshly rendered pairs.
  execFileSync(process.execPath, [path.resolve('scripts/diagram-sync.mjs'), '--update-manifest', `--path=${tempDir}`], { encoding: 'utf8' });

  // Verify visual diagram parity across the generated artifacts
  const parity = verifyDiagramParity(tempDir);
  assert.equal(parity.valid, true, `Generated artifacts must satisfy visual diagram parity: ${JSON.stringify(parity.errors)}`);

  fs.rmSync(tempDir, { recursive: true, force: true });
});

test('Toolforge CLI dispatcher handles hyphenated --path, --generate, and --fix syntax', () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cli-syntax-'));
  const scriptsDir = path.join(tempDir, 'scripts');
  fs.mkdirSync(scriptsDir, { recursive: true });

  const scriptFile = path.join(scriptsDir, 'triage-reporter.mjs');
  fs.writeFileSync(scriptFile, '// Automated triage reporter\nconsole.log("triage");', 'utf8');

  const cliScript = path.resolve('skills/toolforge-cli/src/cli.ps1');
  const output = execFileSync(
    'pwsh',
    [
      '-NoProfile',
      '-File',
      cliScript,
      'sync-docs',
      `--path=${tempDir}`,
      '--generate',
      '--fix',
    ],
    { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] }
  );

  assert.ok(output.includes('Successfully generated 1 workflow documentation and diagram suites.'));
  assert.ok(fs.existsSync(path.join(tempDir, 'docs', 'workflows', 'script-triage-reporter.md')));
  assert.ok(fs.existsSync(path.join(tempDir, 'docs', 'workflows', 'script-triage-reporter.html')));
  assert.ok(fs.existsSync(path.join(tempDir, 'docs', 'workflows', 'script-triage-reporter.png')));

  fs.rmSync(tempDir, { recursive: true, force: true });
});

test('Toolforge root router toolforge.ps1 forwards CLI commands and retains legacy memory switches', () => {
  const routerScript = path.resolve('toolforge.ps1');

  // Test 1: Route sync-docs help
  const helpOutput = execFileSync(
    'pwsh',
    ['-NoProfile', '-File', routerScript, 'sync-docs', '--help'],
    { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] }
  );
  assert.ok(helpOutput.includes('toolforge - Toolforge Marketplace CLI'));
  assert.ok(helpOutput.includes('sync-docs'));

  // Test 2: Help fallback when invoked without arguments
  const noArgsOutput = execFileSync(
    'pwsh',
    ['-NoProfile', '-File', routerScript, '-Help'],
    { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] }
  );
  assert.ok(noArgsOutput.includes('Commands:'));
  assert.ok(noArgsOutput.includes('list'));
  assert.ok(noArgsOutput.includes('install'));
  assert.ok(noArgsOutput.includes('sync-docs'));
});
