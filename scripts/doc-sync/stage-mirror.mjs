// scripts/doc-sync/stage-mirror.mjs
import fs from 'node:fs';
import path from 'node:path';

function hasFile(dir) {
  return fs.readdirSync(dir, { recursive: true, withFileTypes: true })
    .some((e) => e.isFile() && !path.join(e.parentPath ?? e.path, e.name).split(path.sep).includes('.git'));
}

export function stageMirror({ sourceDir, cloneDir, homeFrom }) {
  if (!fs.existsSync(sourceDir)) throw new Error(`STAGE_SOURCE_MISSING: ${sourceDir}`);
  const entries = fs.readdirSync(sourceDir).filter((n) => n !== '.git');
  if (entries.length === 0 || !hasFile(sourceDir)) throw new Error(`STAGE_SOURCE_EMPTY: ${sourceDir}`);
  if (homeFrom) {
    if (!entries.includes(homeFrom)) throw new Error(`STAGE_HOME_FROM_MISSING: ${homeFrom}`);
    if (entries.includes('Home.md')) throw new Error(`STAGE_HOME_COLLISION: both ${homeFrom} and Home.md exist`);
  } else if (!entries.includes('Home.md')) {
    throw new Error(`STAGE_NO_HOME: ${sourceDir} has no top-level Home.md`);
  }

  for (const name of fs.readdirSync(cloneDir)) {
    if (name === '.git') continue;
    fs.rmSync(path.join(cloneDir, name), { recursive: true, force: true });
  }
  for (const name of entries) {
    const dest = homeFrom && name === homeFrom ? 'Home.md' : name;
    fs.cpSync(path.join(sourceDir, name), path.join(cloneDir, dest), { recursive: true });
  }
}
