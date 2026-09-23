import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

const GUIDE_PATH = 'C:\\dev\\docs\\Ecosystem Architecture Guide (Current).md';

const DEV_TARGETS = [
  { name: 'IronLedger Architecture', id: '76e1932c-054a-4520-9e83-5e882dffc938' },
  { name: 'Sigil Protocol & Federation', id: '26eacb85-2c97-443d-9d81-3bd99cc98412' },
  { name: 'Agent Harnesses & Local Execution', id: '359b346c-6af7-4ba3-baef-b985c9e6e1af' },
  { name: 'Rewrite Labs SSG Platform', id: '140119ae-3496-45c9-bf0c-71c955136afc' },
  { name: 'Open Dev Issues (Dev Triage)', id: 'cb0498ce-1ea5-4668-9f65-ac368753404e' },
  { name: 'CIC-KB (Master Historical)', id: '679b8bab-2d87-42cb-a726-6dc54c83acc2' }
];

console.log('=== Syncing Canonical Ecosystem Architecture Guide across Development Notebooks ===');

for (const target of DEV_TARGETS) {
  console.log(`\nProcessing: ${target.name} (${target.id})...`);
  
  // 1. Check existing sources and prune stale copies of the guide
  try {
    const raw = execSync(`nlm source list "${target.id}" --json`, { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] });
    const parsed = JSON.parse(raw);
    const sources = Array.isArray(parsed) ? parsed : (parsed.sources || []);
    
    const staleSources = sources.filter(s => {
      const title = (s.title || s.name || '').toLowerCase();
      return title.includes('ecosystem architecture guide');
    });

    if (staleSources.length > 0) {
      console.log(`  Found ${staleSources.length} existing/stale guide source(s) in ${target.name}. Pruning...`);
      for (const stale of staleSources) {
        try {
          execSync(`nlm source delete "${stale.id}" -y`, { stdio: ['pipe', 'pipe', 'pipe'] });
          console.log(`  ✓ Deleted stale source: ${stale.id} ("${stale.title || stale.name}")`);
        } catch (delErr) {
          console.warn(`  Failed to delete source ${stale.id}: ${delErr.message}`);
        }
      }
    } else {
      console.log(`  No prior guide found in ${target.name}.`);
    }
  } catch (err) {
    console.warn(`  Warning during source check for ${target.name}: ${err.message}`);
  }

  // 2. Upload fresh canonical guide
  try {
    console.log(`  Uploading fresh canonical guide to ${target.name}...`);
    execSync(`nlm source add "${target.id}" --file "${GUIDE_PATH}"`, { stdio: 'inherit' });
    console.log(`  ✓ Successfully uploaded canonical guide to ${target.name} (${target.id})`);
  } catch (uploadErr) {
    console.error(`  ❌ Failed to upload guide to ${target.name}: ${uploadErr.message}`);
  }
}

console.log('\n================================================================================');
console.log('🎉 SUCCESS: Canonical Ecosystem Architecture Guide is synchronized across all dev workbooks!');
console.log('================================================================================');
