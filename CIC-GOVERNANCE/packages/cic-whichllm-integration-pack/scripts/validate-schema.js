#!/usr/bin/env node
/**
 * Schema Validation Script
 * CIC-WHICHLLM-INTEGRATION-PACK v1.0
 *
 * Validates a sample ingestion record against whichllm-ingestion-schema.json.
 * Uses Node's built-in JSON parsing only — no external schema validator needed.
 *
 * Usage:
 *   node scripts/validate-schema.js [path/to/record.json]
 *   cat record.json | node scripts/validate-schema.js
 *
 * Exit codes: 0 = valid, 1 = invalid / error
 */

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SCHEMA = JSON.parse(
  readFileSync(join(__dirname, '../schemas/whichllm-ingestion-schema.json'), 'utf8')
);

// ─── Minimal structural validator (required fields + const checks) ────────────

function validate(schema, obj) {
  const errors = [];

  // Required fields
  for (const field of schema.required ?? []) {
    if (!Object.prototype.hasOwnProperty.call(obj, field)) {
      errors.push(`Missing required field: '${field}'`);
    }
  }

  // const checks
  for (const [key, def] of Object.entries(schema.properties ?? {})) {
    if (def.const !== undefined && obj[key] !== undefined && obj[key] !== def.const) {
      errors.push(`Field '${key}': expected const '${def.const}', got '${obj[key]}'`);
    }
    if (def.pattern && obj[key] !== undefined && typeof obj[key] === 'string') {
      const re = new RegExp(def.pattern);
      if (!re.test(obj[key])) {
        errors.push(`Field '${key}': value '${obj[key]}' does not match pattern ${def.pattern}`);
      }
    }
    if (def.minLength && typeof obj[key] === 'string' && obj[key].length < def.minLength) {
      errors.push(`Field '${key}': length ${obj[key].length} < minLength ${def.minLength}`);
    }
    if (def.maxLength && typeof obj[key] === 'string' && obj[key].length > def.maxLength) {
      errors.push(`Field '${key}': length ${obj[key].length} > maxLength ${def.maxLength}`);
    }
  }

  // Nested governance attestation
  if (obj.governance) {
    const govSchema = SCHEMA.$defs.GovernanceAttestation;
    for (const field of govSchema.required ?? []) {
      if (!Object.prototype.hasOwnProperty.call(obj.governance, field)) {
        errors.push(`governance: Missing required field: '${field}'`);
      }
    }
  }

  return errors;
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  let raw;

  const filePath = process.argv[2];
  if (filePath && filePath !== '-') {
    raw = readFileSync(resolve(filePath), 'utf8');
  } else if (filePath === '-') {
    // Read from stdin when explicitly requested with '-'
    const chunks = [];
    for await (const chunk of process.stdin) chunks.push(chunk);
    raw = chunks.join('');
  } else {
    // No input: validate the built-in sample record
    raw = JSON.stringify(SAMPLE_RECORD);
    console.log('No input provided — validating built-in sample record.\n');
  }

  let obj;
  try {
    obj = JSON.parse(raw);
  } catch (e) {
    console.error(`JSON parse error: ${e.message}`);
    process.exit(1);
  }

  const errors = validate(SCHEMA, obj);

  if (errors.length === 0) {
    console.log('✓  Record is valid against whichllm-ingestion-schema.json v1.0.0');
    process.exit(0);
  } else {
    console.error(`✗  Validation failed with ${errors.length} error(s):`);
    for (const e of errors) console.error(`   • ${e}`);
    process.exit(1);
  }
}

// ─── Built-in sample (used when no input is provided) ────────────────────────

const SAMPLE_RECORD = {
  $schemaVersion: '1.0.0',
  cicSpecVersion: '2.4.0',
  amendmentRef: '§2/S3-A1',
  harvesterId: 'cic-whichllm-default-v1',
  tenantId: 'tenant-sample',
  queryId: 'sample-qry-001',
  resultId: 'a'.repeat(64),
  prompt: 'What is the CIC lineage contract?',
  modelHints: ['gpt-4o'],
  model: 'gpt-4o',
  response: 'The CIC lineage contract is an append-only hash chain…',
  latencyMs: 312,
  ingestionTimestamp: '2026-08-23T10:00:00.000Z',
  lineageHash: 'b'.repeat(64),
  governance: {
    attestationId: 'c'.repeat(64),
    harvesterId: 'cic-whichllm-default-v1',
    specVersion: '2.4.0',
    amendmentRef: '§2/S3-A1',
    status: 'passed',
    checksRun: [
      { checkId: 'GC-01', name: 'Harvester Registration Integrity', result: 'pass' },
      { checkId: 'GC-02', name: 'Payload Schema Compliance', result: 'pass' },
      { checkId: 'GC-03', name: 'Prompt Policy Gate', result: 'pass' },
      { checkId: 'GC-04', name: 'Model Allowlist Enforcement', result: 'pass' },
      { checkId: 'GC-05', name: 'Attestation Completeness', result: 'pass' },
    ],
    attestedAt: '2026-08-23T10:00:00.312Z',
    notes: [],
  },
  retryCount: 0,
  tags: ['sample', 'cic-v2.4.0'],
};

main().catch((err) => {
  console.error('Validation script error:', err);
  process.exit(1);
});
