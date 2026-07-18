#!/usr/bin/env node

/**
 * db-migrate skill: PostgreSQL migration helper
 * Generates, validates, and reviews migrations for safety
 */

import fs from 'fs';
import path from 'path';

const MIGRATIONS_DIR = 'src/db/migrations';
const RISKY_PATTERNS = [
  { pattern: /DROP\s+COLUMN/i, risk: 'CRITICAL', message: 'Dropping columns breaks existing queries' },
  { pattern: /ALTER\s+COLUMN.*TYPE/i, risk: 'HIGH', message: 'Type changes can lose data' },
  { pattern: /ADD\s+\w+.*NOT\s+NULL\s+(?!DEFAULT)/i, risk: 'HIGH', message: 'NOT NULL without DEFAULT blocks existing rows' },
  { pattern: /CREATE\s+INDEX\s+(?!CONCURRENTLY)/i, risk: 'MEDIUM', message: 'Index creation locks table; use CONCURRENTLY' },
];

function generate(description: string) {
  if (!fs.existsSync(MIGRATIONS_DIR)) {
    fs.mkdirSync(MIGRATIONS_DIR, { recursive: true });
  }

  const timestamp = new Date().toISOString().replace(/[^0-9]/g, '').slice(0, 14);
  const sequence = String(fs.readdirSync(MIGRATIONS_DIR).length + 1).padStart(3, '0');
  const fileName = `${timestamp}_${sequence}_${description.toLowerCase().replace(/\s+/g, '_')}.sql`;
  const filePath = path.join(MIGRATIONS_DIR, fileName);

  const template = `-- Migration: ${description}
-- Generated: ${new Date().toISOString()}

-- UP: Apply this migration
-- DOWN: Rollback this migration

BEGIN;

-- TODO: Add your SQL here

COMMIT;
`;

  fs.writeFileSync(filePath, template);
  console.log(`✅ Created: ${filePath}`);
}

function validate() {
  if (!fs.existsSync(MIGRATIONS_DIR)) {
    console.log('No migrations directory found.');
    return;
  }

  const files = fs.readdirSync(MIGRATIONS_DIR).filter(f => f.endsWith('.sql'));
  let errors = 0;

  files.forEach(file => {
    const content = fs.readFileSync(path.join(MIGRATIONS_DIR, file), 'utf-8');

    if (!content.includes('BEGIN;') || !content.includes('COMMIT;')) {
      console.error(`❌ ${file}: Missing BEGIN/COMMIT transaction`);
      errors++;
    }

    RISKY_PATTERNS.forEach(({ pattern, risk, message }) => {
      if (pattern.test(content)) {
        console.warn(`⚠️  ${file} [${risk}]: ${message}`);
      }
    });
  });

  if (errors === 0) {
    console.log(`✅ Validated ${files.length} migrations`);
  } else {
    console.error(`❌ Found ${errors} validation errors`);
    process.exit(1);
  }
}

function review(filePath: string) {
  if (!fs.existsSync(filePath)) {
    console.error(`❌ File not found: ${filePath}`);
    process.exit(1);
  }

  const content = fs.readFileSync(filePath, 'utf-8');
  const fileName = path.basename(filePath);

  console.log(`\n📋 Review: ${fileName}\n`);

  let hasIssues = false;

  RISKY_PATTERNS.forEach(({ pattern, risk, message }) => {
    if (pattern.test(content)) {
      console.log(`${risk === 'CRITICAL' ? '❌' : '⚠️ '} [${risk}] ${message}`);
      hasIssues = true;
    }
  });

  if (!hasIssues) {
    console.log('✅ No risky patterns detected');
  }

  if (!content.includes('BEGIN;') || !content.includes('COMMIT;')) {
    console.log('⚠️  [STRUCTURE] Missing BEGIN/COMMIT transaction wrapper');
  }

  console.log();
}

function status() {
  console.log('Status: Run `npm run migrate` to check applied migrations');
}

// CLI
const cmd = process.argv[2];
const arg = process.argv[3];

switch (cmd) {
  case 'generate':
    generate(arg || 'new_migration');
    break;
  case 'validate':
    validate();
    break;
  case 'review':
    review(arg || '');
    break;
  case 'status':
    status();
    break;
  default:
    console.log(`Usage: db-migrate <generate|validate|review|status> [args]`);
}
