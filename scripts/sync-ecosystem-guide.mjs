import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import {
  generateAndWriteGuide,
  DEFAULT_GUIDE_OUTPUT_PATH,
  DEFAULT_REGISTRY_PATH
} from './ecosystem-compiler.mjs';

export const GUIDE_PATH = DEFAULT_GUIDE_OUTPUT_PATH;
export const REGISTRY_PATH = DEFAULT_REGISTRY_PATH;
export const DRIVE_DOC_ID = '1zTiYlA6NIhJRDsr0_9s0I_oQKUnW6l8eJX6xqYGRM_M';

export const KEY_CLUSTER_NOTEBOOKS = [
  { name: 'AI News and Tools', id: 'bec5a197-8256-4eba-af78-c4881cc28fdd' },
  { name: 'Operations Briefings & Research Logs', id: 'c17c2a18-3562-4fe4-9880-c1289ec5f506' },
  { name: 'CIC-KB', id: '679b8bab-2d87-42cb-a726-6dc54c83acc2' },
  { name: 'Open Dev Issues', id: 'cb0498ce-1ea5-4668-9f65-ac368753404e' },
  { name: 'Rewrite Labs', id: '140119ae-3496-45c9-bf0c-71c955136afc' }
];

export function resolveSyncTargets(options = {}) {
  const opts = typeof options === 'string' ? { registryPath: options, cluster: 'all' } : (options || {});
  if (opts.cluster === 'all') {
    const regPath = opts.registryPath || REGISTRY_PATH;
    if (fs.existsSync(regPath)) {
      try {
        const reg = JSON.parse(fs.readFileSync(regPath, 'utf8'));
        const targets = (reg.notebooks || []).map(n => ({ name: n.title, id: n.notebook_id }));
        if (targets.length > 0) {
          return targets;
        }
      } catch (err) {
        console.error('Failed to parse notebooklm-registry.json:', err.message);
      }
    }
    return KEY_CLUSTER_NOTEBOOKS;
  }
  return KEY_CLUSTER_NOTEBOOKS;
}

export const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function isDriveGuideSource(source) {
  const title = (source.title || source.name || '').toLowerCase();
  const type = (source.type || source.source_type || '').toLowerCase();
  const url = source.url || '';
  const driveId = source.drive_id || source.document_id || '';

  if (driveId === DRIVE_DOC_ID || url.includes(DRIVE_DOC_ID)) {
    return true;
  }
  if (title.includes('ecosystem architecture guide') && (type.includes('drive') || type.includes('doc') || url.includes('docs.google.com'))) {
    return true;
  }
  return false;
}

function isGuideSource(source) {
  const title = (source.title || source.name || '').toLowerCase();
  return title.includes('ecosystem architecture guide');
}

export async function syncEcosystemGuide(options = {}) {
  const guidePath = options.guidePath || GUIDE_PATH;

  if (options.compileOnly) {
    const compileResult = generateAndWriteGuide(guidePath, options);
    return { success: true, compiledOnly: true, compileResult };
  }

  if (!options.noCompile) {
    generateAndWriteGuide(guidePath, options);
  }

  const targets = resolveSyncTargets(options);
  console.log(`=== Syncing Canonical Ecosystem Architecture Guide across ${targets.length} Notebooks (cluster: ${options.cluster || 'key'}) ===`);

  for (const target of targets) {
    console.log(`\nProcessing: ${target.name} (${target.id})...`);

    if (options.dryRun) {
      console.log(`  [DRY-RUN] Would sync guide to ${target.name}`);
      continue;
    }

    let hasDriveSource = false;
    const staleUploadedSources = [];

    try {
      const raw = execSync(`nlm source list "${target.id}" --json`, {
        encoding: 'utf8',
        stdio: ['pipe', 'pipe', 'pipe']
      });
      const parsed = JSON.parse(raw);
      const sources = Array.isArray(parsed) ? parsed : (parsed.sources || []);

      for (const source of sources) {
        if (isDriveGuideSource(source)) {
          hasDriveSource = true;
        } else if (isGuideSource(source)) {
          staleUploadedSources.push(source);
        }
      }
    } catch (err) {
      console.warn(`  Warning during source check for ${target.name}: ${err.message}`);
    }

    if (hasDriveSource) {
      try {
        console.log(`  Found Drive master source in ${target.name}. Refreshing in-place...`);
        execSync(`nlm source sync "${target.id}" --confirm`, { stdio: 'inherit' });
        console.log(`  ✓ Synced Drive source in ${target.name} (${target.id})`);
      } catch (syncErr) {
        console.error(`  ❌ Failed to sync Drive source in ${target.name}: ${syncErr.message}`);
      }
    } else {
      if (staleUploadedSources.length > 0) {
        console.log(`  Found ${staleUploadedSources.length} existing/stale guide source(s) in ${target.name}. Pruning...`);
        for (const stale of staleUploadedSources) {
          const sourceId = stale.id || stale.source_id;
          try {
            execSync(`nlm source delete "${sourceId}" -y`, { stdio: ['pipe', 'pipe', 'pipe'] });
            console.log(`  ✓ Deleted stale source: ${sourceId} ("${stale.title || stale.name}")`);
          } catch (delErr) {
            console.warn(`  Failed to delete source ${sourceId}: ${delErr.message}`);
          }
        }
      }

      try {
        console.log(`  Uploading fresh canonical guide to ${target.name}...`);
        execSync(`nlm source add "${target.id}" --file "${guidePath}"`, { stdio: 'inherit' });
        console.log(`  ✓ Successfully uploaded canonical guide to ${target.name} (${target.id})`);
      } catch (uploadErr) {
        console.error(`  ❌ Failed to upload guide to ${target.name}: ${uploadErr.message}`);
      }
    }

    await sleep(options.pacingMs !== undefined ? options.pacingMs : 3500);
  }

  console.log('\n================================================================================');
  console.log('🎉 SUCCESS: Canonical Ecosystem Architecture Guide is synchronized!');
  console.log('================================================================================');
  return { success: true, targetsCount: targets.length };
}

export function parseCliArgs(args) {
  const options = {
    dryRun: args.includes('--dry-run'),
    noCompile: args.includes('--no-compile'),
    compileOnly: args.includes('--compile-only'),
    cluster: 'key'
  };

  const clusterArg = args.find((a) => a.startsWith('--cluster='));
  if (clusterArg) {
    options.cluster = clusterArg.split('=')[1];
  } else if (args.includes('--all')) {
    options.cluster = 'all';
  }

  return options;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const options = parseCliArgs(process.argv.slice(2));
  syncEcosystemGuide(options)
    .then(() => process.exit(0))
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}
