import * as fs from 'fs';
import * as path from 'path';

const MAX_LEVELS = 20;
const cache = new Map<string, string>();

export function findRepoRoot(startDir: string): string {
  const cached = cache.get(startDir);
  if (cached) return cached;

  let dir = path.resolve(startDir);
  for (let i = 0; i < MAX_LEVELS; i++) {
    if (fs.existsSync(path.join(dir, '.git'))) {
      cache.set(startDir, dir);
      return dir;
    }
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  throw new Error(`findRepoRoot: no .git found within ${MAX_LEVELS} levels of ${startDir}`);
}
