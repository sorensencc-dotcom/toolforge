#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const INVENTORY_PATH = path.join(ROOT, 'docs', 'documentation-publishing.json');
const CLASSIFICATIONS = new Set(['public', 'internal', 'archive']);

export function validateInventory(inventory) {
  const errors = [];
  if (!inventory || inventory.version !== 1 || !Array.isArray(inventory.entries)) {
    return ['inventory must have version 1 and an entries array'];
  }
  const mkdocs = new Map();
  const wiki = new Map();
  inventory.entries.forEach((entry, index) => {
    const prefix = `entries[${index}]`;
    if (!entry?.id) errors.push(`${prefix}.id is required`);
    if (!entry?.source) errors.push(`${prefix}.source is required`);
    if (!entry?.owner) errors.push(`${prefix}.owner is required`);
    if (!CLASSIFICATIONS.has(entry?.classification)) errors.push(`${prefix}.classification must be public, internal, or archive`);
    if (!Number.isInteger(entry?.reviewIntervalDays) || entry.reviewIntervalDays <= 0) errors.push(`${prefix}.reviewIntervalDays must be a positive integer`);
    for (const [name, map] of [['mkdocs', mkdocs], ['wiki', wiki]]) {
      if (!entry?.[name]) continue;
      if (map.has(entry[name])) errors.push(`duplicate ${name} destination: ${entry[name]}`);
      else map.set(entry[name], index);
    }
  });
  return errors;
}

export function loadInventory(file = INVENTORY_PATH) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

export function validateInventoryFiles(inventory, root = ROOT) {
  return inventory.entries.flatMap((entry) => fs.existsSync(path.resolve(root, entry.source)) ? [] : [`missing source: ${entry.source}`]);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const inventory = loadInventory(process.argv[2]);
  const errors = [...validateInventory(inventory), ...validateInventoryFiles(inventory)];
  if (errors.length) { console.error(errors.join('\n')); process.exit(1); }
  console.log(`Documentation inventory valid: ${inventory.entries.length} entries`);
}
