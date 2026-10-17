import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
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

test('discoverWorkflows: discovers scripts, endpoints, and workflows from repository structure', () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'recon-test-'));

  // Create mock package.json
  fs.writeFileSync(path.join(tempDir, 'package.json'), JSON.stringify({
    name: 'test-repo',
    scripts: {
      start: 'node src/server.mjs',
      'job:ingest': 'node scripts/ingest.mjs && node scripts/process.mjs',
    },
  }));

  // Create mock scripts/
  fs.mkdirSync(path.join(tempDir, 'scripts'), { recursive: true });
  fs.writeFileSync(path.join(tempDir, 'scripts', 'backup.mjs'), '// Automated nightly backup workflow\nconsole.log("running");');

  // Create mock .github/workflows/
  fs.mkdirSync(path.join(tempDir, '.github', 'workflows'), { recursive: true });
  fs.writeFileSync(path.join(tempDir, '.github', 'workflows', 'ci.yml'), 'name: CI\njobs:\n  test:\n    runs-on: ubuntu-latest\n');

  // Create mock src/server.mjs
  fs.mkdirSync(path.join(tempDir, 'src'), { recursive: true });
  fs.writeFileSync(path.join(tempDir, 'src', 'server.mjs'), 'if (req.url === "/api/health") {}\nif (url.pathname === "/api/submit") {}');

  const workflows = discoverWorkflows(tempDir);
  assert.ok(workflows.length >= 4, `Expected at least 4 workflows, found ${workflows.length}`);

  const types = workflows.map((w) => w.type);
  assert.ok(types.includes(WORKFLOW_TYPES.SCRIPT));
  assert.ok(types.includes(WORKFLOW_TYPES.CI_PIPELINE));
  assert.ok(types.includes(WORKFLOW_TYPES.API_ENDPOINT));

  fs.rmSync(tempDir, { recursive: true, force: true });
});

test('auditWorkflowDocumentation: identifies undocumented workflows and stale documentation', () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'audit-doc-test-'));
  const wf1 = { id: 'job-ingest', name: 'Ingest Job', type: 'script', sourceFile: 'scripts/ingest.mjs' };
  const wf2 = { id: 'job-backup', name: 'Backup Job', type: 'script', sourceFile: 'scripts/backup.mjs' };

  // Document wf1 only
  fs.mkdirSync(path.join(tempDir, 'docs'), { recursive: true });
  fs.writeFileSync(path.join(tempDir, 'docs', 'ingest.md'), '# Ingest Job\nDetails on job-ingest.');

  const audited = auditWorkflowDocumentation(tempDir, [wf1, wf2]);
  const a1 = audited.find((w) => w.id === 'job-ingest');
  const a2 = audited.find((w) => w.id === 'job-backup');

  assert.equal(a1.isDocumented, true);
  assert.equal(a2.isDocumented, false);
  assert.equal(a2.needsUpdate, true);

  fs.rmSync(tempDir, { recursive: true, force: true });
});

test('generateMermaidForWorkflow & generateDocumentationForWorkflow: produces compliant specs', () => {
  const workflow = {
    id: 'data-pipeline',
    name: 'Data Ingestion Pipeline',
    description: 'Processes incoming event packets.',
    sourceFile: 'scripts/pipeline.mjs',
    stages: ['Packet Ingress', 'Validation Guard', 'Database Storage'],
  };

  const mermaid = generateMermaidForWorkflow(workflow);
  assert.ok(mermaid.startsWith('flowchart TD'));
  assert.ok(mermaid.includes('Packet Ingress'));
  assert.ok(mermaid.includes('N1 --> N2'));

  const doc = generateDocumentationForWorkflow(workflow);
  assert.ok(doc.includes('# Data Ingestion Pipeline'));
  assert.ok(doc.includes('## Workflow architecture'));
  assert.ok(doc.includes('```mermaid'));
  assert.ok(doc.includes('1. **Packet Ingress**'));
});

test('materializeWorkflowDocumentation: creates documentation and diagram artifacts', () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'materialize-test-'));
  const workflow = {
    id: 'cache-sync',
    name: 'Cache Synchronization',
    description: 'Syncs memory cache to durable storage.',
    sourceFile: 'scripts/cache.mjs',
    stages: ['Scan Dirty Entries', 'Flush to Disk'],
  };

  const res = materializeWorkflowDocumentation(workflow, { outputDir: tempDir, renderPng: false });
  assert.equal(res.generated, true);
  assert.ok(fs.existsSync(res.docPath));

  const content = fs.readFileSync(res.docPath, 'utf8');
  assert.ok(content.includes('# Cache Synchronization'));
  assert.ok(content.includes('![Architecture Diagram](cache-sync.png)'));
  assert.ok(content.includes('<details><summary>Mermaid source...</summary>'));

  fs.rmSync(tempDir, { recursive: true, force: true });
});
