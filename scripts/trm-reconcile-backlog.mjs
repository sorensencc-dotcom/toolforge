import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const DEV_ROOT = path.resolve(__dirname, '..');

const PENDING_DIR = path.resolve(DEV_ROOT, '.harness/tasks/pending');
const COMPLETED_DIR = path.resolve(DEV_ROOT, '.harness/tasks/completed');
const QUARANTINE_DIR = path.resolve(DEV_ROOT, 'trm-drive/inbox/quarantine');
const OUTBOX_DIR = path.resolve(DEV_ROOT, 'trm-drive/inbox/outbox');
const LEDGER_PATH = path.resolve(DEV_ROOT, 'trm-drive/inbox/ledger.jsonl');

export function reconcileBacklog(options = {}) {
  const dryRun = options.dryRun !== false;
  const results = {
    dryRun,
    completedMoved: [],
    quarantinedMoved: [],
    retainedPending: [],
    ledgerUpdated: {
      completed: 0,
      quarantined: 0,
      mockUrlsCleared: 0
    }
  };

  fs.mkdirSync(COMPLETED_DIR, { recursive: true });
  fs.mkdirSync(QUARANTINE_DIR, { recursive: true });

  const completedIds = new Set();
  const quarantinedIds = new Set();

  if (fs.existsSync(PENDING_DIR)) {
    const files = fs.readdirSync(PENDING_DIR);
    for (const f of files) {
      const fullPath = path.join(PENDING_DIR, f);
      let data = {};
      try {
        const raw = fs.readFileSync(fullPath, 'utf8');
        data = JSON.parse(raw);
      } catch {
        continue;
      }

      const id = data.id || data.action_id || f;
      const content = data.body || data.raw_content || data.summary || '';
      const isStub = Boolean(
        data.title === 'Unknown Title' ||
        data.intent === 'triage_mobile_request' ||
        content.length < 50 ||
        data.context?.body_fetch_failed
      );

      const receiptPath = path.join(OUTBOX_DIR, `receipt-${id}-completed.json`);
      const completedTaskPath = path.join(COMPLETED_DIR, `${id}.json`);
      const isAlreadyCompleted = fs.existsSync(receiptPath) || fs.existsSync(completedTaskPath);

      if (isAlreadyCompleted) {
        results.completedMoved.push({ file: f, id, title: data.title });
        completedIds.add(id);
        if (!dryRun) {
          const dest = path.join(COMPLETED_DIR, f);
          try {
            fs.renameSync(fullPath, dest);
          } catch {
            fs.copyFileSync(fullPath, dest);
            fs.unlinkSync(fullPath);
          }
        }
      } else if (isStub) {
        results.quarantinedMoved.push({ file: f, id, title: data.title, reason: 'body_fetch_failed or <50 chars' });
        quarantinedIds.add(id);
        if (!dryRun) {
          const dest = path.join(QUARANTINE_DIR, f);
          try {
            fs.renameSync(fullPath, dest);
          } catch {
            fs.copyFileSync(fullPath, dest);
            fs.unlinkSync(fullPath);
          }
        }
      } else {
        results.retainedPending.push({ file: f, id, title: data.title, target: data.target });
      }
    }
  }

  // Reconcile Ledger
  if (fs.existsSync(LEDGER_PATH)) {
    const rawLedger = fs.readFileSync(LEDGER_PATH, 'utf8');
    const lines = rawLedger.trim().split('\n').filter(Boolean);
    let mutated = false;

    const updatedLines = lines.map(line => {
      try {
        const row = JSON.parse(line);
        const id = row.id || row.action_id;
        let rowMutated = false;

        // 1. Mark completed if receipt exists or was moved to completed
        const receiptPath = path.join(OUTBOX_DIR, `receipt-${id}-completed.json`);
        const completedTaskPath = path.join(COMPLETED_DIR, `${id}.json`);
        if ((completedIds.has(id) || fs.existsSync(receiptPath) || fs.existsSync(completedTaskPath)) && row.status !== 'COMPLETED' && row.status !== 'DONE') {
          row.status = 'COMPLETED';
          row.completed_at = row.completed_at || new Date().toISOString();
          results.ledgerUpdated.completed++;
          rowMutated = true;
        }

        // 2. Mark quarantined if stub
        const isStub = Boolean(
          row.title === 'Unknown Title' ||
          row.intent === 'triage_mobile_request' ||
          row.context?.body_fetch_failed ||
          (quarantinedIds.has(id))
        );
        if (isStub && row.status !== 'COMPLETED' && row.status !== 'DONE' && row.status !== 'QUARANTINED_INSUFFICIENT_DATA') {
          row.status = 'QUARANTINED_INSUFFICIENT_DATA';
          row.error = row.error || 'Quarantined: body fetch failed or missing directives';
          row.quarantined_at = row.quarantined_at || new Date().toISOString();
          results.ledgerUpdated.quarantined++;
          rowMutated = true;
        }

        // 3. Clear fake mock/staged issue URLs
        if (row.issue_url && (row.issue_url.includes('mock-') || row.issue_url.includes('staged-'))) {
          row.remediated_fake_issue_url = row.issue_url;
          row.issue_url = null;
          results.ledgerUpdated.mockUrlsCleared++;
          rowMutated = true;
        }

        if (rowMutated) {
          mutated = true;
          return JSON.stringify(row);
        }
        return line;
      } catch {
        return line;
      }
    });

    if (mutated && !dryRun) {
      fs.writeFileSync(LEDGER_PATH, updatedLines.join('\n') + '\n', 'utf8');
    }
  }

  return results;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const isLive = process.argv.includes('--live');
  const res = reconcileBacklog({ dryRun: !isLive });
  console.log(JSON.stringify(res, null, 2));

  if (isLive) {
    import('./trm-ingress-watcher.mjs').then(({ refreshLedgerMarkdown }) => {
      try {
        refreshLedgerMarkdown();
        console.log('✓ Successfully refreshed LEDGER.md and ICF status feed.');
      } catch (err) {
        console.warn('Notice: refreshLedgerMarkdown:', err.message);
      }
    });
  }
}
