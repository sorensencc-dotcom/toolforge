import { execSync } from 'child_process';
import { NOTEBOOK_TARGETS } from '../kb-sync/core/targets.mjs';

const findings = [];
for (const [key, id] of Object.entries(NOTEBOOK_TARGETS)) {
  if (!id || id.startsWith('<')) continue;
  try {
    const raw = execSync(`nlm source list "${id}" --json`, { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] });
    const parsed = JSON.parse(raw);
    const sources = Array.isArray(parsed) ? parsed : (parsed.sources || []);
    for (const s of sources) {
      const title = (s.title || s.name || '');
      if (title.toLowerCase().includes('ecosystem') || title.toLowerCase().includes('architecture guide') || title.toLowerCase().includes('guide')) {
        findings.push({ category: key, notebookId: id, sourceId: s.id, title, type: s.type });
      }
    }
  } catch (err) {
    // skip
  }
}
console.log('--- MATCHING SOURCES ---');
console.log(JSON.stringify(findings, null, 2));
