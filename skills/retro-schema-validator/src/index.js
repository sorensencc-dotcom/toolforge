#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Retro Schema Validator
 * Validates .retro/*.json files against canonical schema v1.0.
 */

export const SCHEMA = {
  date: { type: 'string' },
  type: { type: 'string' },
  metrics: {
    type: 'object',
    fields: {
      unit_scale: { type: 'number', min: 0, max: 100 },
      active_days: { type: 'number', min: 0, max: 7 },
      commits_authored: { type: 'number' },
      issues_closed: { type: 'number' },
    },
  },
  sections: {
    type: 'object',
    fields: {
      wins: { type: 'array' },
      blockers: { type: 'array' },
      next: { type: 'array' },
    },
  },
  notes: { type: 'string' },
};

function typeOf(value) {
  if (Array.isArray(value)) return 'array';
  if (value === null) return 'null';
  return typeof value;
}

function validateNode(data, schemaFields, fieldPath, filePath, violations) {
  const dataKeys = data && typeof data === 'object' && !Array.isArray(data) ? Object.keys(data) : [];

  for (const [field, spec] of Object.entries(schemaFields)) {
    const full = fieldPath ? `${fieldPath}.${field}` : field;
    if (!(field in (data || {}))) {
      violations.push({ file: filePath, field: full, level: 'error', message: `Missing required field: ${full}` });
      continue;
    }

    const value = data[field];
    const actualType = typeOf(value);

    if (spec.type === 'object') {
      if (actualType !== 'object') {
        violations.push({ file: filePath, field: full, level: 'error', message: `Field "${full}" must be object, got ${actualType}` });
        continue;
      }
      validateNode(value, spec.fields, full, filePath, violations);
      continue;
    }

    if (actualType !== spec.type) {
      violations.push({ file: filePath, field: full, level: 'error', message: `Field "${full}" must be ${spec.type}, got ${actualType}` });
      continue;
    }

    if (spec.type === 'number') {
      if (spec.min !== undefined && value < spec.min) {
        violations.push({ file: filePath, field: full, level: 'error', message: `Field "${full}" must be >= ${spec.min}, got ${value}` });
      }
      if (spec.max !== undefined && value > spec.max) {
        violations.push({ file: filePath, field: full, level: 'error', message: `Field "${full}" must be <= ${spec.max}, got ${value}` });
      }
    }
  }

  // Unknown-field detection at this level
  const knownKeys = Object.keys(schemaFields);
  for (const key of dataKeys) {
    if (!knownKeys.includes(key)) {
      const full = fieldPath ? `${fieldPath}.${key}` : key;
      violations.push({ file: filePath, field: full, level: 'warning', message: `Unknown field not in schema v1.0: ${full}` });
    }
  }
}

export function validateFile(filePath) {
  const violations = [];

  if (!fs.existsSync(filePath)) {
    return { file: filePath, ok: false, violations: [{ file: filePath, field: 'file', level: 'error', message: 'File not found' }] };
  }

  let data;
  try {
    data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (e) {
    return { file: filePath, ok: false, violations: [{ file: filePath, field: 'json', level: 'error', message: `Invalid JSON: ${e.message}` }] };
  }

  validateNode(data, SCHEMA, '', filePath, violations);

  return { file: filePath, ok: !violations.some((v) => v.level === 'error'), violations };
}

export function validateFiles(filePaths) {
  const results = filePaths.map(validateFile);
  const violations = results.flatMap((r) => r.violations);

  let level = 'pass';
  for (const v of violations) {
    if (v.level === 'error') level = 'error';
    else if (v.level === 'warning' && level !== 'error') level = 'warning';
  }

  let verdict = 'GREEN';
  if (level === 'error') verdict = 'RED';
  else if (level === 'warning') verdict = 'YELLOW';

  return {
    status: level === 'error' ? 'error' : 'success',
    verdict,
    filesValidated: filePaths.length,
    violations,
    timestamp: new Date().toISOString(),
  };
}

function printReport(output, verbose) {
  if (verbose) {
    console.log(JSON.stringify(output, null, 2));
    return;
  }
  if (output.violations.length === 0) {
    console.log(`✓ Schema Compliance: All ${output.filesValidated} file(s) compliant with v1.0`);
  } else {
    output.violations.forEach((v) => {
      const icon = { error: '❌', warning: '⚠' }[v.level];
      console.log(`${icon} ${v.file} [${v.field}]: ${v.message}`);
    });
  }
  console.log(`\n${output.verdict} - ${output.violations.length === 0 ? 'Retro schema is valid' : `Fix ${output.violations.length} violation(s) above`}`);
}

function main() {
  const args = {
    filePath: process.argv[2] && !process.argv[2].startsWith('--') ? process.argv[2] : undefined,
    all: process.argv.includes('--all'),
    verbose: process.argv.includes('--verbose'),
    failOnWarning: process.argv.includes('--failOnWarning'),
  };

  let filesToValidate = [];
  if (args.all) {
    const retroDir = path.join(process.cwd(), '.retro');
    if (fs.existsSync(retroDir)) {
      filesToValidate = fs.readdirSync(retroDir).filter((f) => f.endsWith('.json')).map((f) => path.join(retroDir, f));
    }
  } else if (args.filePath) {
    filesToValidate = [args.filePath];
  } else {
    filesToValidate = [path.join(process.cwd(), '.retro', `${new Date().toISOString().split('T')[0]}-1.json`)];
  }

  const output = validateFiles(filesToValidate);
  printReport(output, args.verbose);

  process.exit(
    output.verdict === 'GREEN' ? 0 :
    output.verdict === 'YELLOW' ? (args.failOnWarning ? 1 : 0) :
    2
  );
}

const isMain = process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1]);
if (isMain) main();
