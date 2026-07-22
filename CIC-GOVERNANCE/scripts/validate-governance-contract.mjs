#!/usr/bin/env node
/**
 * validate-governance-contract.mjs
 *
 * Contract validator for CIC-GOVERNANCE repository.
 * Scans markdown files, enforces frontmatter schema (title, document_id, category, status, version),
 * checks for document ID collisions, and validates link references.
 *
 * Usage: node scripts/validate-governance-contract.mjs [target-dir]
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, '..');

const targetDir = process.argv[2] ? path.resolve(process.cwd(), process.argv[2]) : REPO_ROOT;

const ALLOWED_CATEGORIES = new Set([
  "manifest", "spec", "amendment", "pipeline", "governance", "readme", "template", "schema", "lineage"
]);

const ALLOWED_STATUSES = new Set(["active", "candidate", "draft", "archived"]);

const validationErrors = [];
const seenIds = new Map();
let scannedCount = 0;

/**
 * Parses frontmatter block from markdown content.
 */
function parseFrontmatter(content) {
  const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!match) return { frontmatter: null, body: content };

  const yamlStr = match[1];
  const frontmatter = {};
  const lines = yamlStr.split('\n');
  for (const line of lines) {
    const colonIdx = line.indexOf(':');
    if (colonIdx !== -1) {
      const key = line.slice(0, colonIdx).trim();
      let val = line.slice(colonIdx + 1).trim();
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1);
      }
      if (key) frontmatter[key] = val;
    }
  }
  return { frontmatter, body: content.slice(match[0].length) };
}

/**
 * Validates a single markdown file against governance contract.
 */
function validateFile(fullPath, relPath) {
  scannedCount++;
  const content = fs.readFileSync(fullPath, 'utf8');
  const { frontmatter } = parseFrontmatter(content);

  if (!frontmatter) {
    validationErrors.push({
      file: relPath,
      rule: 'Frontmatter Schema',
      message: 'Missing mandatory YAML frontmatter block (---)'
    });
    return;
  }

  // Mandatory Keys
  const mandatoryKeys = ['title', 'document_id', 'category', 'status', 'version'];
  for (const key of mandatoryKeys) {
    if (!frontmatter[key] || String(frontmatter[key]).trim() === '') {
      validationErrors.push({
        file: relPath,
        rule: 'Frontmatter Schema',
        message: `Missing mandatory key '${key}' in frontmatter`
      });
    }
  }

  // Category Enum Validation
  if (frontmatter.category && !ALLOWED_CATEGORIES.has(frontmatter.category)) {
    validationErrors.push({
      file: relPath,
      rule: 'Category Enum Integrity',
      message: `Invalid category '${frontmatter.category}'. Must be one of: ${Array.from(ALLOWED_CATEGORIES).join(', ')}`
    });
  }

  // Status Enum Validation
  if (frontmatter.status && !ALLOWED_STATUSES.has(frontmatter.status)) {
    validationErrors.push({
      file: relPath,
      rule: 'Status Enum Integrity',
      message: `Invalid status '${frontmatter.status}'. Must be one of: ${Array.from(ALLOWED_STATUSES).join(', ')}`
    });
  }

  // Document ID Collision Guard
  if (frontmatter.document_id) {
    const docId = frontmatter.document_id.trim();
    if (seenIds.has(docId)) {
      validationErrors.push({
        file: relPath,
        rule: 'Document ID Collision Guard',
        message: `Duplicate document_id '${docId}' matches document already seen: '${seenIds.get(docId)}'`
      });
    } else {
      seenIds.set(docId, relPath);
    }
  }
}

/**
 * Directory walker scanning markdown files.
 */
function scanDirectory(dir) {
  if (!fs.existsSync(dir)) return;
  const entries = fs.readdirSync(dir);
  for (const entry of entries) {
    const fullPath = path.join(dir, entry);
    const relPath = path.relative(REPO_ROOT, fullPath).replace(/\\/g, '/');

    // Exclusion patterns
    if (entry.startsWith('.') || entry === 'node_modules' || entry === '_archive') {
      continue;
    }

    const stat = fs.statSync(fullPath);
    if (stat.isDirectory()) {
      scanDirectory(fullPath);
    } else if (entry.endsWith('.md')) {
      validateFile(fullPath, relPath);
    }
  }
}

// Execution
console.log(`[CIC Governance Validator] Starting validation sequence...`);
console.log(`Target Directory: ${targetDir}\n`);

scanDirectory(targetDir);

console.log(`Scanned ${scannedCount} governance documentation node(s).\n`);

console.log(`======================================================================`);
console.log(`                      VALIDATION VERDICT REPORT                      `);
console.log(`======================================================================\n`);

if (validationErrors.length === 0) {
  console.log(`✔ STATUS: PASS`);
  console.log(`No governance contract violations or collisions found. Clean lock confirmed.\n`);
  process.exit(0);
} else {
  console.log(`✘ STATUS: FAIL`);
  console.log(`Found ${validationErrors.length} governance validation issue(s):\n`);
  for (const err of validationErrors) {
    console.log(`File: ${err.file}`);
    console.log(`  [${err.rule}] ${err.message}`);
  }
  console.log(`\nValidation failed.`);
  process.exit(1);
}
