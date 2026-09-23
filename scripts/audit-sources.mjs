import { execSync } from 'child_process';
import { NOTEBOOK_TARGETS } from '../kb-sync/core/targets.mjs';

const results = {};
for (const [key, id] of Object.entries(NOTEBOOK_TARGETS)) {
  if (!id || id.startsWith('<') || results[id]) continue;
  try {
    const raw = execSync(`nlm source list "${id}" --json`, { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] });
    const parsed = JSON.parse(raw);
    const sources = Array.isArray(parsed) ? parsed : (parsed.sources || []);
    results[key] = {
      id,
      sourceCount: sources.length,
      sources: sources.map(s => ({ id: s.id, title: s.title || s.name, type: s.type }))
    };
  } catch (err) {
    results[key] = { id, error: err.message };
  }
}
console.log(JSON.stringify(results, null, 2));
