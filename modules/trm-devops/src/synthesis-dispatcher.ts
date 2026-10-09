import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { SynthesisProfile, NotebookRoutingManifest, NotebookRouteConfig } from './core/types.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const PROMPT_OPERATIONAL_SYSTEMS = `Run an operational audit on the latest session logs and sources. Answer strictly using verified log data. If a section has no entries, output "NONE". Do not speculate or generate narrative background.

1. INVARIANT & STATE DRIFT:
   - What schema constraints, accounting rules, or architectural boundaries were modified or violated?
   - Flag any unratified state or divergence from core charters.

2. RUNTIME FAILURES & EDGE CASES:
   - What explicit errors, stack traces, unhandled edge cases, or tool failures occurred?
   - Identify the exact root cause or missing parameter if logged.

3. MANUAL FRICTION:
   - Where did manual intervention occur that should be automated via CLI hook, MCP tool, or script?

4. ACTIONABLE DELTAS:
   - List concrete implementation tasks, test additions, or refactors required for the backlog. Format: [COMPONENT] Task description.`;

export const PROMPT_OPERATIONAL_CLIENT = `Run a delivery and pipeline triage on the latest entries. Answer strictly using logged facts. If a section has no entries, output "NONE".

1. PIPELINE CHECKPOINTS:
   - What scanner sweeps, accessibility checks, or build steps failed validation?

2. UPSTREAM/DOWNSTREAM BREAKS:
   - Were breaking changes, API deprecations, or external dependency failures logged?

3. BLOCKED DELIVERABLES:
   - What client assets, audit reports, or approvals are currently blocked awaiting Tier 1 review?`;

export const PROMPT_RESEARCH_CIC = `Run a historical research synthesis on the latest sources and logs. Extract unresolved narrative contradictions, under-sourced claims, adjacent topics, and follow-up inquiry vectors.

1. CONTRADICTIONS & DISCREPANCIES:
   - What conflicting statements or timeline discrepancies exist across the sources?

2. UNDER-SOURCED CLAIMS:
   - What factual assertions lack primary source attribution or corroborating evidence?

3. ADJACENT TOPICS & VECTORS:
   - What related historical figures, entities, or events warrant deeper investigation?

4. FOLLOW-UP RESEARCH ACTIONS:
   - List specific archival query targets, document requests, or accession tasks.`;

export function resolveSynthesisPrompt(profile: string): string {
  switch (profile) {
    case 'operational_systems':
      return PROMPT_OPERATIONAL_SYSTEMS;
    case 'operational_client':
      return PROMPT_OPERATIONAL_CLIENT;
    case 'research_narrative':
    default:
      return PROMPT_RESEARCH_CIC;
  }
}

export interface LogContextValidation {
  valid: boolean;
  abortMessage?: string;
  error?: string;
}

export interface SessionLogPayload {
  runId?: string;
  rawText?: string;
  stackTrace?: string;
  date?: string;
  isTruncated?: boolean;
}

export function validateLogContext(runId: string, logData: SessionLogPayload): LogContextValidation {
  const effectiveRunId = runId || logData.runId || 'unknown_run';

  if (logData.isTruncated) {
    return {
      valid: false,
      abortMessage: `[AUDIT_HALTED: Missing log context for ${effectiveRunId}]`,
      error: 'Log data marked as truncated'
    };
  }

  if (logData.stackTrace && (logData.stackTrace.includes('...') || logData.stackTrace.includes('[truncated]'))) {
    return {
      valid: false,
      abortMessage: `[AUDIT_HALTED: Missing log context for ${effectiveRunId}]`,
      error: 'Incomplete or truncated stack trace detected'
    };
  }

  if (logData.date && (logData.date.includes('unknown') || isNaN(Date.parse(logData.date)))) {
    return {
      valid: false,
      abortMessage: `[AUDIT_HALTED: Missing log context for ${effectiveRunId}]`,
      error: 'Invalid or incomplete date string'
    };
  }

  if (logData.rawText !== undefined && logData.rawText.trim().length === 0) {
    return {
      valid: false,
      abortMessage: `[AUDIT_HALTED: Missing log context for ${effectiveRunId}]`,
      error: 'Empty log content'
    };
  }

  return { valid: true };
}

export interface ActionableDelta {
  component: string;
  task: string;
}

export interface ParsedOperationalAudit {
  invariantDrift: string[];
  runtimeFailures: string[];
  manualFriction: string[];
  actionableDeltas: ActionableDelta[];
  rawText: string;
  isZeroFindings: boolean;
}

export function parseOperationalAuditOutput(rawOutput: string): ParsedOperationalAudit {
  const lines = rawOutput.split('\n').map(l => l.trim());
  const result: ParsedOperationalAudit = {
    invariantDrift: [],
    runtimeFailures: [],
    manualFriction: [],
    actionableDeltas: [],
    rawText: rawOutput,
    isZeroFindings: false
  };

  let currentSection: 'drift' | 'failures' | 'friction' | 'deltas' | null = null;

  for (const line of lines) {
    if (!line) continue;
    if (line.includes('1. INVARIANT & STATE DRIFT')) {
      currentSection = 'drift';
      continue;
    } else if (line.includes('2. RUNTIME FAILURES & EDGE CASES')) {
      currentSection = 'failures';
      continue;
    } else if (line.includes('3. MANUAL FRICTION')) {
      currentSection = 'friction';
      continue;
    } else if (line.includes('4. ACTIONABLE DELTAS')) {
      currentSection = 'deltas';
      continue;
    }

    if (line.toUpperCase() === 'NONE' || line.toUpperCase() === '- NONE') {
      continue;
    }

    if (line.startsWith('-') || line.startsWith('*')) {
      const cleaned = line.replace(/^[-*]\s*/, '').trim();
      if (cleaned.toUpperCase() === 'NONE') continue;

      if (currentSection === 'drift') {
        result.invariantDrift.push(cleaned);
      } else if (currentSection === 'failures') {
        result.runtimeFailures.push(cleaned);
      } else if (currentSection === 'friction') {
        result.manualFriction.push(cleaned);
      } else if (currentSection === 'deltas') {
        const match = cleaned.match(/^\[([^\]]+)\]\s*(.*)$/);
        if (match) {
          result.actionableDeltas.push({ component: match[1].trim(), task: match[2].trim() });
        } else {
          result.actionableDeltas.push({ component: 'GENERAL', task: cleaned });
        }
      }
    }
  }

  result.isZeroFindings =
    result.invariantDrift.length === 0 &&
    result.runtimeFailures.length === 0 &&
    result.manualFriction.length === 0 &&
    result.actionableDeltas.length === 0;

  return result;
}

export function formatOperationalGapsTable(
  entries: Array<{ target: string; profile: string; deltas: ActionableDelta[]; status?: string }>
): string {
  const header = `| Target Notebook | Profile | Component | Backlog Task | Status |\n| :--- | :--- | :--- | :--- | :--- |`;
  const rows: string[] = [];

  for (const entry of entries) {
    if (!entry.deltas || entry.deltas.length === 0) {
      rows.push(`| **${entry.target}** | \`${entry.profile}\` | - | *None (Clean run)* | \`${entry.status || 'CLEAN'}\` |`);
    } else {
      for (const d of entry.deltas) {
        rows.push(`| **${entry.target}** | \`${entry.profile}\` | \`${d.component}\` | ${d.task} | \`${entry.status || 'OPEN'}\` |`);
      }
    }
  }

  return `### TRM Operational Gaps & Synthesis\n\n${header}\n${rows.join('\n')}\n`;
}

export function loadNotebookManifest(manifestPath?: string): NotebookRoutingManifest {
  const defaultPath = path.resolve(__dirname, '..', 'notebooks.json');
  const targetPath = manifestPath ? path.resolve(manifestPath) : defaultPath;

  if (!fs.existsSync(targetPath)) {
    return { notebooks: [] };
  }

  try {
    const raw = fs.readFileSync(targetPath, 'utf8');
    const parsed = JSON.parse(raw);
    if (parsed && Array.isArray(parsed.notebooks)) {
      return parsed as NotebookRoutingManifest;
    }
    return { notebooks: [] };
  } catch {
    return { notebooks: [] };
  }
}

export function getProfileForNotebook(
  notebookIdOrTitle: string,
  manifest?: NotebookRoutingManifest
): SynthesisProfile {
  const activeManifest = manifest || loadNotebookManifest();
  const found = activeManifest.notebooks.find(
    n => n.id === notebookIdOrTitle || n.name.toLowerCase() === notebookIdOrTitle.toLowerCase()
  );
  return found?.synthesis_profile || 'research_narrative';
}
