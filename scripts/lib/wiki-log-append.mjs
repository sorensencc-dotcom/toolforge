import fs from 'node:fs';
import path from 'node:path';

const MAX_LOG_BYTES = 500 * 1024; // 500KB

/**
 * Appends an entry to wiki/Log.md, rotating the file to wiki/archive/
 * first if it has grown past MAX_LOG_BYTES. Without this, every daily
 * bot appends forever and the file grows unbounded (hit 16MB/495k lines).
 */
export function appendToWikiLog(repoRoot, entry) {
  const logPath = path.join(repoRoot, 'wiki', 'Log.md');
  appendToLogFile(logPath, entry);
}

export async function appendToWikiLogAsync(repoRoot, entry) {
  const logPath = path.join(repoRoot, 'wiki', 'Log.md');
  await appendToLogFileAsync(logPath, entry);
}

/** Same rotation behavior for a Log.md at an arbitrary path (e.g. a vault root). */
export function appendToLogFile(logPath, entry) {
  rotateIfOversized(path.dirname(logPath), logPath);
  fs.appendFileSync(logPath, entry, 'utf8');
}

export async function appendToLogFileAsync(logPath, entry) {
  rotateIfOversized(path.dirname(logPath), logPath);
  await fs.promises.appendFile(logPath, entry, 'utf8');
}

function rotateIfOversized(wikiDir, logPath) {
  let size = 0;
  try {
    size = fs.statSync(logPath).size;
  } catch {
    return;
  }
  if (size < MAX_LOG_BYTES) return;

  const archiveDir = path.join(wikiDir, 'archive');
  fs.mkdirSync(archiveDir, { recursive: true });
  const stamp = new Date().toISOString().slice(0, 10);
  let archivePath = path.join(archiveDir, `Log-${stamp}.md`);
  let suffix = 1;
  while (fs.existsSync(archivePath)) {
    archivePath = path.join(archiveDir, `Log-${stamp}-${suffix}.md`);
    suffix += 1;
  }
  fs.renameSync(logPath, archivePath);
  const relArchive = `archive/${path.basename(archivePath)}`;
  fs.writeFileSync(
    logPath,
    `# Log\n\nRotated ${stamp} (prior entries exceeded ${MAX_LOG_BYTES} bytes). Prior entries: [${path.basename(archivePath)}](${relArchive}).\n`,
    'utf8'
  );
}
