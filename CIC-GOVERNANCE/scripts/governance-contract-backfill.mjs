#!/usr/bin/env node
/**
 * governance-contract-backfill.mjs
 *
 * Backfills YAML frontmatter across CIC-GOVERNANCE markdown documents.
 * Enforces path-namespaced ID fallbacks, non-destructive frontmatter merging,
 * and category enum mapping.
 *
 * Usage: node scripts/governance-contract-backfill.mjs [--dry-run] [--target=path]
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, '..');

const DRY_RUN = process.argv.includes('--dry-run');
const TARGET_ARG = process.argv.find(arg => arg.startsWith('--target='));
const SPECIFIC_TARGET = TARGET_ARG ? TARGET_ARG.split('=')[1] : null;

// Category enum set
const ALLOWED_CATEGORIES = new Set([
  "manifest", "spec", "amendment", "pipeline", "governance", "readme", "template", "schema", "lineage"
]);

// Allowed status set
const ALLOWED_STATUSES = new Set(["active", "candidate", "draft", "archived"]);

// Explicit 15-file mapping table for deterministic backfill
const FILE_MAP = {
  "README.md": { document_id: "CIC-GOV-ROOT-README", category: "readme", status: "candidate", version: "1.0.0" },
  "AMENDMENTS/AMD-v2.4.0-0001.md": { document_id: "AMD-V2-4-0-0001", category: "amendment", status: "candidate", version: "2.4.0" },
  "AMENDMENTS/README.md": { document_id: "CIC-GOV-AMENDMENTS-README", category: "readme", status: "candidate", version: "1.0.0" },
  "LINEAGE/README.md": { document_id: "CIC-GOV-LINEAGE-README", category: "readme", status: "active", version: "2.4.0" },
  "MANIFEST/CIC-GOV-MANIFEST-001.md": { document_id: "CIC-GOV-MANIFEST-001", category: "manifest", status: "candidate", version: "1.1.0-candidate.1" },
  "MANIFEST/gate-implementation-status.md": { document_id: "CIC-GOV-GATE-STATUS", category: "manifest", status: "candidate", version: "1.0.0" },
  "MANIFEST/PHASE-09-CHARTER.md": { document_id: "CIC-GOV-PHASE-09-CHARTER", category: "manifest", status: "active", version: "1.0.0" },
  "MANIFEST/PHASE-09-ONBOARDING.md": { document_id: "CIC-GOV-PHASE-09-ONBOARDING", category: "manifest", status: "active", version: "1.0.0" },
  "MANIFEST/README.md": { document_id: "CIC-GOV-MANIFEST-README", category: "readme", status: "candidate", version: "1.0.0" },
  "PIPELINE/CIC-Pipeline-v2.4.0.md": { document_id: "CIC-PIPELINE-V2-4-0", category: "pipeline", status: "candidate", version: "2.4.0" },
  "PIPELINE/README.md": { document_id: "CIC-GOV-PIPELINE-README", category: "readme", status: "candidate", version: "1.0.0" },
  "README/CIC-README.md": { document_id: "CIC-README-DOC", category: "readme", status: "candidate", version: "1.0.0" },
  "SCHEMA/README.md": { document_id: "CIC-GOV-SCHEMA-README", category: "readme", status: "candidate", version: "1.0.0" },
  "SPEC/CIC-GATE-SPEC-001.md": { document_id: "CIC-GATE-SPEC-001", category: "spec", status: "candidate", version: "1.0.0-candidate.1" },
  "SPEC/Spec_v2.4.0.md": { document_id: "CIC-SPEC-V2-4-0", category: "spec", status: "candidate", version: "2.4.0" },
  "SPEC/README.md": { document_id: "CIC-GOV-SPEC-README", category: "readme", status: "candidate", version: "1.0.0" },
  "WRAPPERS/README.md": { document_id: "CIC-GOV-WRAPPERS-README", category: "readme", status: "candidate", version: "1.0.0" },
  "templates/commit-message-template.md": { document_id: "CIC-GOV-COMMIT-MESSAGE-TEMPLATE", category: "template", status: "active", version: "1.0.0" },
  "REVIEW.md": { document_id: "CIC-GOV-REVIEW", category: "readme", status: "active", version: "1.0.0" }
};

/**
 * Derives path-namespaced Document ID when header ID is absent.
 */
function deriveDocumentId(relPath) {
  const norm = relPath.replace(/\\/g, '/');
  const baseNoExt = norm.replace(/\.md$/, '');
  const sanitized = baseNoExt.replace(/[/\\._\s]+/g, '-').toUpperCase();
  return sanitized.startsWith('CIC-GOV-') ? sanitized : `CIC-GOV-${sanitized}`;
}

/**
 * Extracts title from H1 or header metadata.
 */
function extractTitle(content, relPath) {
  const h1Match = content.match(/^#\s+(.+)$/m);
  if (h1Match) return h1Match[1].trim();
  const basename = path.basename(relPath, '.md');
  return basename.replace(/[-_]/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

/**
 * Infer category based on relative path folder or mapping.
 */
function inferCategory(relPath) {
  const norm = relPath.replace(/\\/g, '/');
  const parts = norm.split('/');
  if (parts.length > 1) {
    const folder = parts[0].toLowerCase();
    if (folder === 'manifest') return 'manifest';
    if (folder === 'spec') return 'spec';
    if (folder === 'amendments') return 'amendment';
    if (folder === 'pipeline') return 'pipeline';
    if (folder === 'schema') return 'schema';
    if (folder === 'lineage') return 'lineage';
    if (folder === 'templates') return 'template';
  }
  if (parts[parts.length - 1].toLowerCase() === 'readme.md') return 'readme';
  return 'governance';
}

/**
 * Infer status from document body.
 */
function inferStatus(content) {
  if (content.match(/Status:\s*`?APPROVED`?/i) || content.match(/Status:\s*`?ACTIVE`?/i)) return 'active';
  if (content.match(/Status:\s*`?ARCHIVED`?/i)) return 'archived';
  if (content.match(/Status:\s*`?DRAFT`?/i)) return 'draft';
  return 'candidate';
}

/**
 * Infer version from document body.
 */
function inferVersion(content) {
  const vMatch = content.match(/Version:\s*`?([vV]?\d+\.\d+\.\d+[^`\r\n\s]*)`?/);
  if (vMatch) return vMatch[1].replace(/^[vV]/, '');
  return '1.0.0';
}

/**
 * Parse simple YAML block lines into a key-value record.
 */
function parseYamlBlock(yamlStr) {
  const result = {};
  const lines = yamlStr.split('\n');
  for (const line of lines) {
    const colonIdx = line.indexOf(':');
    if (colonIdx !== -1) {
      const key = line.slice(0, colonIdx).trim();
      let val = line.slice(colonIdx + 1).trim();
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1);
      }
      if (key) result[key] = val;
    }
  }
  return result;
}

/**
 * Stringify key-value record to standard YAML frontmatter block.
 */
function formatYamlBlock(fm) {
  let out = '---\n';
  out += `title: "${fm.title}"\n`;
  out += `document_id: "${fm.document_id}"\n`;
  out += `category: "${fm.category}"\n`;
  out += `status: "${fm.status}"\n`;
  out += `version: "${fm.version}"\n`;
  out += '---\n';
  return out;
}

/**
 * Backfill frontmatter on a single file.
 */
function processMarkdownFile(filePath, relPath) {
  const content = fs.readFileSync(filePath, 'utf8');
  const normRelPath = relPath.replace(/\\/g, '/');
  
  const explicitMapping = FILE_MAP[normRelPath] || {};

  const frontmatterMatch = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  
  let existingFm = {};
  let bodyContent = content;

  if (frontmatterMatch) {
    existingFm = parseYamlBlock(frontmatterMatch[1]);
    bodyContent = content.slice(frontmatterMatch[0].length).replace(/^\r?\n/, '');
  }

  // Merge frontmatter key-by-key (preserving non-empty existing values)
  const mergedFm = {
    title: existingFm.title || explicitMapping.title || extractTitle(bodyContent, relPath),
    document_id: existingFm.document_id || explicitMapping.document_id || deriveDocumentId(relPath),
    category: existingFm.category || explicitMapping.category || inferCategory(relPath),
    status: existingFm.status || explicitMapping.status || inferStatus(bodyContent),
    version: existingFm.version || explicitMapping.version || inferVersion(bodyContent)
  };

  const formattedFm = formatYamlBlock(mergedFm);
  const finalContent = formattedFm + '\n' + bodyContent;

  const changed = finalContent !== content;

  if (changed && !DRY_RUN) {
    fs.writeFileSync(filePath, finalContent, 'utf8');
  }

  return {
    relPath: normRelPath,
    changed,
    fm: mergedFm
  };
}

// ---------------------------------------------------------------------------
// Execution Entrypoint & Dry-Run Checklist
// ---------------------------------------------------------------------------
console.log(`================================================================================`);
console.log(`CIC-GOVERNANCE Contract Backfill ${DRY_RUN ? '(DRY RUN MODE)' : '(LIVE WRITE MODE)'}`);
console.log(`================================================================================\n`);

const filesToProcess = SPECIFIC_TARGET
  ? [SPECIFIC_TARGET]
  : Object.keys(FILE_MAP);

const results = [];
const seenIds = new Map();
let checklistPassed = true;

for (const relPath of filesToProcess) {
  const fullPath = path.join(REPO_ROOT, relPath);
  if (!fs.existsSync(fullPath)) {
    console.warn(`[WARN] File not found: ${relPath}`);
    continue;
  }

  const res = processMarkdownFile(fullPath, relPath);
  results.push(res);

  // Check ID collisions
  if (seenIds.has(res.fm.document_id)) {
    console.error(`[CHECKLIST FAIL] ID Collision: '${res.fm.document_id}' used by both '${relPath}' and '${seenIds.get(res.fm.document_id)}'`);
    checklistPassed = false;
  } else {
    seenIds.set(res.fm.document_id, relPath);
  }

  // Check category validity
  if (!ALLOWED_CATEGORIES.has(res.fm.category)) {
    console.error(`[CHECKLIST FAIL] Invalid category '${res.fm.category}' in '${relPath}'`);
    checklistPassed = false;
  }

  // Check status validity
  if (!ALLOWED_STATUSES.has(res.fm.status)) {
    console.error(`[CHECKLIST FAIL] Invalid status '${res.fm.status}' in '${relPath}'`);
    checklistPassed = false;
  }

  console.log(`  [${res.changed ? 'MODIFY' : 'PASS'}] ${relPath}`);
  console.log(`      ID: ${res.fm.document_id} | Category: ${res.fm.category} | Status: ${res.fm.status} | Version: ${res.fm.version}`);
}

console.log(`\n--------------------------------------------------------------------------------`);
console.log(`Dry-Run Checklist Verification: ${checklistPassed ? '✔ ALL CHECKS PASSED' : '✘ CHECKLIST FAILURES DETECTED'}`);
console.log(`Processed: ${results.length} files | Modified: ${results.filter(r => r.changed).length} files`);
console.log(`--------------------------------------------------------------------------------\n`);

if (!checklistPassed) {
  process.exit(1);
}
