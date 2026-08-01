import * as fs from 'node:fs';
import * as path from 'node:path';

export interface TopicMeta {
  topic: string;
  path: string;
  description: string;
  tags: string[];
  status: string;
  updated_at: string;
}

export interface TopicStats {
  name: string;
  fullPath: string;
  meta: TopicMeta | null;
  sourceCount: number;
  extractCount: number;
  stagingBatches: string[];
  hasVisionAnalysis: boolean;
  hasCrosslinks: boolean;
  hasTrmIngest: boolean;
  updatedAt: string | null;
}

export type TrmState = 'stub' | 'staging-pending' | 'extract-lag' | 'active' | 'stale';

export interface TrmStatus extends TopicStats {
  state: TrmState;
  nextSteps: string[];
  staleDays: number | null;
}

function countFilesRecursive(dir: string): number {
  if (!fs.existsSync(dir)) return 0;
  let count = 0;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) count += countFilesRecursive(full);
    else count += 1;
  }
  return count;
}

export function scanTopicDir(fullPath: string): TopicStats {
  const name = path.basename(fullPath);
  let meta: TopicMeta | null = null;
  const metaPath = path.join(fullPath, 'topic.json');
  if (fs.existsSync(metaPath)) {
    try {
      meta = JSON.parse(fs.readFileSync(metaPath, 'utf-8'));
    } catch {
      meta = null;
    }
  }

  const entries = fs.existsSync(fullPath) ? fs.readdirSync(fullPath, { withFileTypes: true }) : [];
  const stagingBatches = entries
    .filter((e) => e.isDirectory() && e.name.startsWith('_staging-batch'))
    .map((e) => e.name)
    .sort();

  return {
    name,
    fullPath,
    meta,
    sourceCount: countFilesRecursive(path.join(fullPath, 'sources')),
    extractCount: countFilesRecursive(path.join(fullPath, 'extracts')),
    stagingBatches,
    hasVisionAnalysis: fs.existsSync(path.join(fullPath, 'vision-analysis')),
    hasCrosslinks: countFilesRecursive(path.join(fullPath, 'crosslinks')) > 0,
    hasTrmIngest: fs.existsSync(path.join(fullPath, 'trm-ingest')),
    updatedAt: meta?.updated_at ?? null,
  };
}

const STALE_DAYS_THRESHOLD = 14;
const EXTRACT_LAG_RATIO = 0.5;

export function deriveStatus(stats: TopicStats, now: Date = new Date()): TrmStatus {
  const nextSteps: string[] = [];
  let staleDays: number | null = null;

  if (stats.updatedAt) {
    const updated = new Date(stats.updatedAt);
    staleDays = Math.floor((now.getTime() - updated.getTime()) / (1000 * 60 * 60 * 24));
  }

  let state: TrmState;
  if (stats.sourceCount === 0) {
    state = 'stub';
    nextSteps.push('No sources yet — awaiting intake/research trip. Fine to leave as a placeholder for later research.');
  } else if (stats.stagingBatches.length > 0 && stats.extractCount < stats.sourceCount) {
    state = 'staging-pending';
    nextSteps.push(
      `${stats.stagingBatches.length} staged batch(es) not yet ingested (${stats.stagingBatches.join(', ')}) — run ingest-dir.`
    );
  } else if (stats.sourceCount > 0 && stats.extractCount < stats.sourceCount * EXTRACT_LAG_RATIO) {
    state = 'extract-lag';
    nextSteps.push(
      `Extracts lag sources (${stats.extractCount}/${stats.sourceCount}) — run extract pass.`
    );
  } else if (staleDays !== null && staleDays > STALE_DAYS_THRESHOLD) {
    state = 'stale';
    nextSteps.push(`No metadata update in ${staleDays}d — confirm whether this TRM is closed or just paused.`);
  } else {
    state = 'active';
  }

  if (state !== 'staging-pending' && stats.stagingBatches.length > 0) {
    nextSteps.push(
      `${stats.stagingBatches.length} staging-batch dir(s) fully processed but not cleaned up (${stats.stagingBatches.join(', ')}) — safe to archive/delete.`
    );
  }

  return { ...stats, state, nextSteps, staleDays };
}

export function findAllTopics(vaultRoot: string): string[] {
  const topicsDir = path.join(vaultRoot, 'topics');
  const results: string[] = [];
  if (!fs.existsSync(topicsDir)) return results;

  function walk(dir: string) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (!entry.isDirectory() || entry.name.startsWith('_') || entry.name === 'crosslinks' ||
          entry.name === 'extracts' || entry.name === 'sources' || entry.name === 'lineage') {
        continue;
      }
      const full = path.join(dir, entry.name);
      if (fs.existsSync(path.join(full, 'topic.json')) && fs.existsSync(path.join(full, 'sources'))) {
        results.push(full);
      }
      walk(full);
    }
  }
  walk(topicsDir);
  return results;
}
