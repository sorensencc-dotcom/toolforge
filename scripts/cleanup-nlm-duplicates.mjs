import { spawnSync } from 'node:child_process';
import fs from 'node:fs';

const reg = JSON.parse(fs.readFileSync('C:/dev/notebooklm-registry.json', 'utf8'));

console.log(`Starting NotebookLM deduplication across ${reg.notebooks.length} notebooks...`);

for (const nb of reg.notebooks) {
  console.log(`\n================================================================================`);
  console.log(`Auditing: ${nb.title} (${nb.notebook_id})`);
  console.log(`================================================================================`);

  const res = spawnSync('nlm', ['source', 'list', nb.notebook_id, '--json'], {
    encoding: 'utf8',
    windowsHide: true,
    shell: true
  });

  if (res.status !== 0) {
    console.error(`Failed to list sources: ${res.stderr || res.stdout}`);
    continue;
  }

  let sources = [];
  try {
    const parsed = JSON.parse(res.stdout);
    sources = Array.isArray(parsed) ? parsed : (parsed.sources || []);
  } catch (err) {
    console.error(`Failed to parse source list: ${err.message}`);
    continue;
  }

  const titleMap = new Map();
  const toDelete = [];

  for (const s of sources) {
    if (s.status === 3) {
      console.log(`Found failed source (status 3): ${s.id} - ${s.title}`);
      toDelete.push(s.id);
      continue;
    }
    const t = (s.title || s.name || '').trim().toLowerCase();
    if (!titleMap.has(t)) {
      titleMap.set(t, []);
    }
    titleMap.get(t).push(s);
  }

  for (const [title, list] of titleMap.entries()) {
    if (list.length > 1) {
      console.log(`Found ${list.length} duplicates for "${title}"`);
      // Keep the last source (most recent), delete the earlier duplicates
      for (let i = 0; i < list.length - 1; i++) {
        console.log(`  -> Staged for deletion: ${list[i].id}`);
        toDelete.push(list[i].id);
      }
    }
  }

  if (toDelete.length > 0) {
    console.log(`Purging ${toDelete.length} stale/duplicate source(s)...`);
    const delRes = spawnSync('nlm', ['source', 'delete', ...toDelete, '-y'], {
      encoding: 'utf8',
      windowsHide: true,
      shell: true
    });
    console.log(delRes.stdout || delRes.stderr);
  } else {
    console.log(`✓ Clean: No duplicates or error states.`);
  }
}

console.log('\n================================================================================');
console.log('✓ NotebookLM deduplication complete across all registered notebooks!');
console.log('================================================================================');

