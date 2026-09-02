import * as path from 'path';
import { findRepoRoot } from './findRepoRoot';

export interface IndexPaths {
  dir: string;
  file: string;
}

export function lineagePaths(
  kind: string,
  id: string,
  repoRoot: string = findRepoRoot(__dirname)
): IndexPaths {
  const dir = path.join(repoRoot, 'cic', 'lineage', kind);
  return { dir, file: path.join(dir, `${id}.json`) };
}
