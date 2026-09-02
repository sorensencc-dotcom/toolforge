import * as path from 'node:path';
import type { TrmStatus } from './scanTopic';
import { uncommittedCount } from './vaultGit';

const STATE_LABEL: Record<TrmStatus['state'], string> = {
  stub: 'STUB',
  'staging-pending': 'STAGING PENDING',
  'extract-lag': 'EXTRACT LAG',
  stale: 'STALE',
  active: 'ACTIVE',
};

export function attachGitInfo(vaultRoot: string, statuses: TrmStatus[]): TrmStatus[] {
  return statuses.map((s) => {
    const rel = path.relative(vaultRoot, s.fullPath);
    const dirty = uncommittedCount(vaultRoot, rel);
    if (dirty > 0) {
      return {
        ...s,
        nextSteps: [
          ...s.nextSteps,
          `${dirty} uncommitted file(s) — commit now (see feedback_trm_vault_commit_per_run).`,
        ],
      };
    }
    return s;
  });
}

export function renderTable(statuses: TrmStatus[]): string {
  const rows = statuses.map((s) => {
    const person = path.basename(path.dirname(s.fullPath));
    const label = STATE_LABEL[s.state];
    const next = s.nextSteps.length > 0 ? s.nextSteps.join(' | ') : '—';
    return `${person}/${s.name}\t${label}\t${s.sourceCount} src / ${s.extractCount} ext\t${next}`;
  });
  const header = 'TRM\tSTATE\tCOUNTS\tNEXT STEPS';
  return [header, ...rows].join('\n');
}
