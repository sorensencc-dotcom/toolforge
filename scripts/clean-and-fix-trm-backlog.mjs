import fs from 'node:fs';
import path from 'node:path';

const REPO_ROOT = 'c:/dev';
const HARNESS_PENDING = path.join(REPO_ROOT, '.harness/tasks/pending');
const HARNESS_COMPLETED = path.join(REPO_ROOT, '.harness/tasks/completed');
const HARNESS_ARCHIVE = path.join(REPO_ROOT, '.harness/tasks/archive');
const LEDGER_JSONL = path.join(REPO_ROOT, 'trm-drive/inbox/ledger.jsonl');
const STEP_OUTPUT_FILE = 'C:/Users/soren/.gemini/antigravity/brain/a918b962-6f83-4368-aeff-c95539cecb8c/.system_generated/steps/283/output.txt';
const INCIDENT_REPORTING_TXT = 'C:/Users/soren/Downloads/2026-10-12T124003Z__action__rewrite-mcp__act-03-evaluate-incident-reporting-guardrails.md.txt';

fs.mkdirSync(HARNESS_ARCHIVE, { recursive: true });

// 1. Read exported Google Docs content
const rawOutput = fs.readFileSync(STEP_OUTPUT_FILE, 'utf8');
const start = rawOutput.indexOf('[{');
const end = rawOutput.lastIndexOf('}]') + 2;
const parsedDocs = JSON.parse(rawOutput.slice(start, end));

if (fs.existsSync(INCIDENT_REPORTING_TXT)) {
  parsedDocs.push({
    file: '2026-10-12T124003Z__action__rewrite-mcp__act-03-evaluate-incident-reporting-guardrails.md.gdoc',
    id: '1om7ltrAOTyntwlW0AofAxr6VecUE-h4KgDU8REEMM4k',
    content: fs.readFileSync(INCIDENT_REPORTING_TXT, 'utf8')
  });
}

function extractMetadata(doc) {
  const content = doc.content || '';
  let title = null;
  const tm = content.match(/title:\s*([^\n\r]+?)(?:\s+created:|\s+folder_id:|\n|$)/i);
  if (tm) title = tm[1].trim();
  if (!title) {
    const tm2 = content.match(/\[[A-Z0-9_-]+\]\s*\[[A-Z0-9_-]+\]\s*([^\n\r]+)/i);
    if (tm2) title = tm2[1].trim();
  }
  if (!title) {
    const tm3 = content.match(/#\s*([^\n\r]+)/i);
    if (tm3) title = tm3[1].trim();
  }

  let directive = null;
  const dm = content.match(/### Directive & Objective\s*\n+([^\n#]+)/i) || content.match(/Directive & Objective\s*\n+([^\n#]+)/i);
  if (dm) directive = dm[1].trim();

  let context = null;
  const cm = content.match(/## Context\s*\n+([^\n#]+)/i) || content.match(/Context\s*\n+([^\n#]+)/i);
  if (cm) context = cm[1].trim();

  return {
    file: doc.file,
    id: doc.id,
    title: title || 'Unknown Title',
    summary: directive || context || 'No summary available',
    raw_content: content
  };
}

const docMetaByFile = new Map();
const docMetaById = new Map();

for (const d of parsedDocs) {
  const meta = extractMetadata(d);
  docMetaByFile.set(d.file, meta);
  // Match stem
  const stem = d.file.replace(/\.gdoc$/, '');
  docMetaByFile.set(stem, meta);

  // Extract card ID if present in filename
  const cardIdMatch = d.file.match(/__(act-[^.]+)/);
  if (cardIdMatch) {
    docMetaById.set(cardIdMatch[1], meta);
  }
}

// 2. Process and clean .harness/tasks/pending
const pendingFiles = fs.readdirSync(HARNESS_PENDING);
const dedupeMap = new Map();
let archivedDuplicates = 0;
let updatedPendingCards = 0;

for (const f of pendingFiles) {
  const fullPath = path.join(HARNESS_PENDING, f);
  if (!f.endsWith('.gdoc') && !f.endsWith('.json')) continue;

  try {
    const raw = fs.readFileSync(fullPath, 'utf8');
    const data = JSON.parse(raw);
    const cardId = data.id || f.replace(/\.(gdoc|json)$/, '');

    // Deduplication check: if cardId has been seen, keep only the latest timestamped one
    if (dedupeMap.has(cardId)) {
      const prev = dedupeMap.get(cardId);
      // Compare timestamps
      const prevTs = prev.data.timestamp || '';
      const currTs = data.timestamp || '';
      if (currTs > prevTs) {
        // Archive the older one
        fs.renameSync(prev.fullPath, path.join(HARNESS_ARCHIVE, prev.file));
        dedupeMap.set(cardId, { file: f, fullPath, data });
      } else {
        // Archive current older duplicate
        fs.renameSync(fullPath, path.join(HARNESS_ARCHIVE, f));
      }
      archivedDuplicates++;
      continue;
    } else {
      dedupeMap.set(cardId, { file: f, fullPath, data });
    }
  } catch (err) {
    console.warn(`Could not parse ${f}: ${err.message}`);
  }
}

// Now update all kept pending tasks with their real title, intent, and summary
for (const [cardId, entry] of dedupeMap.entries()) {
  const meta = docMetaByFile.get(entry.file) || docMetaById.get(cardId);
  if (meta) {
    entry.data.title = meta.title;
    entry.data.intent = meta.title;
    entry.data.summary = meta.summary;
    entry.data.raw_preview = meta.summary;
    entry.data.raw_content = meta.raw_content;
    if (entry.data.context) {
      entry.data.context.real_title = meta.title;
      entry.data.context.real_summary = meta.summary;
      entry.data.context.raw_input = meta.title;
    }
    fs.writeFileSync(entry.fullPath, JSON.stringify(entry.data, null, 2), 'utf8');
    updatedPendingCards++;
  }
}

console.log(`[CLEAN-PENDING] Updated ${updatedPendingCards} pending cards with real titles and summaries.`);
console.log(`[CLEAN-PENDING] Archived ${archivedDuplicates} duplicate tasks into .harness/tasks/archive.`);

// 3. Update act-03-evaluate-incident-reporting-guardrails in completed
const act03Completed = path.join(HARNESS_COMPLETED, '2026-10-12T124003Z__action__rewrite-mcp__act-03-evaluate-incident-reporting-guardrails.md.gdoc');
if (fs.existsSync(act03Completed)) {
  try {
    const data = JSON.parse(fs.readFileSync(act03Completed, 'utf8'));
    const meta = docMetaById.get('act-03-evaluate-incident-reporting-guardrails');
    if (meta) {
      data.title = meta.title;
      data.intent = meta.title;
      data.summary = meta.summary;
      data.raw_preview = meta.summary;
      data.raw_content = meta.raw_content;
      fs.writeFileSync(act03Completed, JSON.stringify(data, null, 2), 'utf8');
      console.log(`[CLEAN-COMPLETED] Updated act-03 in .harness/tasks/completed with real metadata.`);
    }
  } catch {}
}

// 4. Update ledger.jsonl
if (fs.existsSync(LEDGER_JSONL)) {
  const lines = fs.readFileSync(LEDGER_JSONL, 'utf8').trim().split('\n').filter(Boolean);
  const updatedLedger = [];
  const seenLedgerCards = new Set();
  let updatedLedgerCount = 0;

  for (let i = lines.length - 1; i >= 0; i--) {
    try {
      const item = JSON.parse(lines[i]);
      const cardId = item.id;

      // Deduplicate ledger entries for the same ID (keep latest)
      if (seenLedgerCards.has(cardId)) {
        continue;
      }
      seenLedgerCards.add(cardId);

      const meta = docMetaById.get(cardId);
      if (meta) {
        item.intent = meta.title;
        item.summary = meta.summary;
        updatedLedgerCount++;
      }
      updatedLedger.unshift(item);
    } catch {
      updatedLedger.unshift(lines[i]);
    }
  }

  fs.writeFileSync(LEDGER_JSONL, updatedLedger.map(x => typeof x === 'string' ? x : JSON.stringify(x)).join('\n') + '\n', 'utf8');
  console.log(`[CLEAN-LEDGER] Updated ${updatedLedgerCount} ledger entries and deduplicated ledger.jsonl (${updatedLedger.length} total active items).`);
}

// 5. Re-render LEDGER.md using trm-ingress-watcher
try {
  const { refreshLedgerMarkdown, emitIcfStatusFeed } = await import('./trm-ingress-watcher.mjs');
  refreshLedgerMarkdown();
  emitIcfStatusFeed();
  console.log(`[CLEAN-LEDGER] Refreshed LEDGER.md and ICF status feed successfully.`);
} catch (err) {
  console.warn(`Could not refresh LEDGER.md automatically: ${err.message}`);
}
