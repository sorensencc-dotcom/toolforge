#!/usr/bin/env node
/**
 * scripts/trm-ingest-drive-v2.mjs
 *
 * TRM Google Drive Ingestion Daemon v2:
 * Deploys Google Drive API v3 plain-text export fallback for .gdoc pointer stubs
 * with resilient frontmatter parsing, OAuth token refresh, and network socket backoff.
 */

import {
  processFile,
  sweepInbox,
  parsePayload,
  resolveGoogleDocId,
  printStatus,
  getValidAccessToken,
  getActiveInboxDirs,
  getActiveOutboxDirs
} from './trm-ingress-watcher.mjs';
import { reconcileDailyReports } from './reconcile-daily-reports.mjs';

export {
  processFile,
  sweepInbox,
  parsePayload,
  resolveGoogleDocId,
  printStatus,
  getValidAccessToken,
  getActiveInboxDirs,
  getActiveOutboxDirs,
  reconcileDailyReports
};

const args = process.argv.slice(2);
const isDryRun = args.includes('--dry-run');

if (process.argv[1] && process.argv[1].replace(/\\/g, '/').endsWith('trm-ingest-drive-v2.mjs')) {
  console.log(`[TRM-INGEST-DRIVE-V2] Starting Drive Ingress Daemon v2 with Google Drive API v3 export fallback (dry-run: ${isDryRun})...`);
  try {
    console.log(`[TRM-INGEST-DRIVE-V2] Executing automated daily report reconciliation preflight...`);
    await reconcileDailyReports({ dryRun: isDryRun });
  } catch (preflightErr) {
    console.warn(`[TRM-INGEST-DRIVE-V2] Reconciliation preflight warning: ${preflightErr.message}`);
  }
  sweepInbox({ dryRun: isDryRun }).then(() => {
    printStatus();
  }).catch(console.error);
}
