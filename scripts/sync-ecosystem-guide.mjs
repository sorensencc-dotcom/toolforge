import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

export const GUIDE_PATH = 'C:\\dev\\docs\\Ecosystem Architecture Guide (Current).md';
export const REGISTRY_PATH = 'C:\\dev\\notebooklm-registry.json';

export function resolveSyncTargets(registryPath = REGISTRY_PATH) {
  let targets = [];
  if (fs.existsSync(registryPath)) {
    try {
      const reg = JSON.parse(fs.readFileSync(registryPath, 'utf8'));
      targets = (reg.notebooks || []).map(n => ({ name: n.title, id: n.notebook_id }));
    } catch (err) {
      console.error('Failed to parse notebooklm-registry.json:', err.message);
    }
  }
  if (targets.length === 0) {
    targets = [
      { name: 'IronLedger Architecture', id: '76e1932c-054a-4520-9e83-5e882dffc938' },
      { name: 'Sigil Protocol & Federation', id: '26eacb85-2c97-443d-9d81-3bd99cc98412' },
      { name: 'Agent Harnesses & Local Execution', id: '359b346c-6af7-4ba3-baef-b985c9e6e1af' },
      { name: 'Rewrite Labs SSG Platform', id: '140119ae-3496-45c9-bf0c-71c955136afc' },
      { name: 'Open Dev Issues (Dev Triage)', id: 'cb0498ce-1ea5-4668-9f65-ac368753404e' },
      { name: 'CIC-KB (Master Historical)', id: '679b8bab-2d87-42cb-a726-6dc54c83acc2' }
    ];
  }
  return targets;
}

export const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export async function syncEcosystemGuide(options = {}) {
  const targets = resolveSyncTargets(options.registryPath);
  console.log(`=== Syncing Canonical Ecosystem Architecture Guide across ${targets.length} Notebooks ===`);

  for (const target of targets) {
    console.log(`\nProcessing: ${target.name} (${target.id})...`);
    
    if (options.dryRun) {
      console.log(`  [DRY-RUN] Would sync guide to ${target.name}`);
      continue;
    }

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

    // Pacing delay to avoid rate limits
    await sleep(options.pacingMs !== undefined ? options.pacingMs : 3500);
  }

  console.log('\n================================================================================');
  console.log('🎉 SUCCESS: Canonical Ecosystem Architecture Guide is synchronized across all dev workbooks!');
  console.log('================================================================================');
  return { success: true, targetsCount: targets.length };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  syncEcosystemGuide({ dryRun: process.argv.includes('--dry-run') })
    .then(() => process.exit(0))
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}
