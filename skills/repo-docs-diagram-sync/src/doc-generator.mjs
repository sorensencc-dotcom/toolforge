// skills/repo-docs-diagram-sync/src/doc-generator.mjs
import fs from 'node:fs';
import path from 'node:path';
import { syncDiagramsInFile } from '../../../scripts/diagram-sync.mjs';

/**
 * Generates Mermaid flowchart syntax representing a discovered workflow.
 * @param {object} workflow
 * @returns {string}
 */
export function generateMermaidForWorkflow(workflow) {
  const stages = workflow.stages && workflow.stages.length > 0
    ? workflow.stages
    : ['Ingress', 'Process', 'Egress'];

  const lines = ['flowchart TD'];
  stages.forEach((stage, idx) => {
    const nodeId = `N${idx + 1}`;
    const safeLabel = stage.replace(/"/g, "'").trim();
    lines.push(`  ${nodeId}["${safeLabel}"]`);
    if (idx > 0) {
      const prevId = `N${idx}`;
      lines.push(`  ${prevId} --> ${nodeId}`);
    }
  });

  return lines.join('\n');
}

/**
 * Generates technical markdown documentation for a workflow following Google Developer Style.
 * @param {object} workflow
 * @returns {string}
 */
export function generateDocumentationForWorkflow(workflow) {
  const title = workflow.name || `Workflow ${workflow.id}`;
  const mermaid = generateMermaidForWorkflow(workflow);
  const stagesList = (workflow.stages || []).map((s, i) => `${i + 1}. **${s}**`).join('\n');

  return `# ${title}

## Overview

${workflow.description || 'This document defines the architecture and execution sequence of this workflow.'}
The implementation lives in \`${workflow.sourceFile}\`.

## Workflow architecture

\`\`\`mermaid
${mermaid}
\`\`\`

## Operational sequence

To execute or trace this workflow, follow these operational stages in order:

${stagesList}

## Verification and monitoring

To verify health, inspect process logs and assertions emitted by \`${workflow.sourceFile}\`.
All transitions adhere strictly to deterministic pipeline execution invariants.
`;
}

/**
 * Materializes generated documentation and renders matching Cathryn Lavery diagrams.
 * @param {object} workflow
 * @param {object} options
 * @returns {{ docPath: string, generated: boolean }}
 */
export function materializeWorkflowDocumentation(workflow, { outputDir, renderPng = true } = {}) {
  fs.mkdirSync(outputDir, { recursive: true });
  const filename = `${workflow.id}.md`;
  const docPath = path.join(outputDir, filename);

  const markdown = generateDocumentationForWorkflow(workflow);
  fs.writeFileSync(docPath, markdown, 'utf8');

  // Trigger diagram-sync to create HTML and render PNG
  syncDiagramsInFile(docPath, { dryRun: false, renderPng });

  return { docPath, generated: true };
}
