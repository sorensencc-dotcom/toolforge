import * as path from 'path';
import { findRepoRoot } from './findRepoRoot';

export interface ArtifactPaths {
  dir: string;
  resultFile: string;
}

export function artifactPaths(
  kind: string,
  id: string,
  repoRoot: string = findRepoRoot(__dirname)
): ArtifactPaths {
  const dir = path.join(repoRoot, 'cic', 'artifacts', kind, id);
  return { dir, resultFile: path.join(dir, 'result.json') };
}
