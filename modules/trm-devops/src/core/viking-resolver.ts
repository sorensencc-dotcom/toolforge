import { formatVikingUri } from '@toolforge/viking-client';
import type { BlastRadiusRating } from './types.ts';

export type DiagnosticContextMode = 'raw' | 'viking';
export type DiagnosticTier = 'L0' | 'L1' | 'L2';

export interface DiagnosticEvidence {
  uri: string;
  content?: string;
  requestedTier: DiagnosticTier;
  resolvedTier?: DiagnosticTier;
  stale?: boolean;
  fallbackReason?: 'STALE_HIGH_SEVERITY' | 'TIER_UNAVAILABLE';
  error?: { code: string; message: string };
}

export interface DefectContextResult {
  mode: DiagnosticContextMode;
  severity: BlastRadiusRating;
  evidence: DiagnosticEvidence[];
  operatorNotes: string[];
  telemetry: Record<string, number>;
}

interface BatchResult {
  uri: string;
  ok: boolean;
  value?: { content: string; stale?: boolean; resolution_tier: DiagnosticTier };
  error?: { vikingCode: string; message: string };
}

interface VikingBatchClient {
  batchRead(items: Array<{ uri: string; tier: DiagnosticTier }>): Promise<{ results: BatchResult[] }>;
  telemetry?: { snapshot(): Record<string, number> };
}

interface ResolveOptions {
  mode: DiagnosticContextMode;
  vault: string;
  client?: VikingBatchClient;
  rawLoader?: (path: string) => Promise<string>;
}

const HIGH_SEVERITY = new Set<BlastRadiusRating>(['P0', 'P1']);

function suspectUri(vault: string, suspect: string): string {
  if (suspect.startsWith('viking://')) return suspect;
  return formatVikingUri({ vault, layer: 'sources', relativePath: suspect.replaceAll('\\', '/') });
}

function telemetrySnapshot(client?: VikingBatchClient): Record<string, number> {
  return client?.telemetry?.snapshot() ?? { rpc_call_count: 0 };
}

export async function resolveDefectContext(
  defect: { blastRadius: BlastRadiusRating; primarySuspects: string[] },
  options: ResolveOptions,
): Promise<DefectContextResult> {
  if (options.mode === 'raw') {
    if (!options.rawLoader) throw new TypeError('rawLoader is required in raw mode');
    const evidence = await Promise.all(defect.primarySuspects.map(async (suspect) => ({
      uri: suspect,
      content: await options.rawLoader!(suspect),
      requestedTier: 'L2' as const,
      resolvedTier: 'L2' as const,
      stale: false,
    })));
    return { mode: 'raw', severity: defect.blastRadius, evidence, operatorNotes: [], telemetry: { rpc_call_count: 0 } };
  }

  if (!options.client) throw new TypeError('client is required in viking mode');
  const uris = defect.primarySuspects.map((suspect) => suspectUri(options.vault, suspect));
  if (uris.length === 0) return { mode: 'viking', severity: defect.blastRadius, evidence: [], operatorNotes: [], telemetry: telemetrySnapshot(options.client) };

  const l1 = await options.client.batchRead(uris.map((uri) => ({ uri, tier: 'L1' })));
  const evidence = new Map<string, DiagnosticEvidence>();
  const fallbackReasons = new Map<string, 'STALE_HIGH_SEVERITY' | 'TIER_UNAVAILABLE'>();
  const operatorNotes: string[] = [];

  for (const item of l1.results) {
    if (!item.ok) {
      if (item.error?.vikingCode === 'TIER_UNAVAILABLE') fallbackReasons.set(item.uri, 'TIER_UNAVAILABLE');
      else evidence.set(item.uri, { uri: item.uri, requestedTier: 'L1', error: { code: item.error?.vikingCode ?? 'INTERNAL_ERROR', message: item.error?.message ?? 'Viking read failed' } });
      continue;
    }
    if (item.value?.stale && HIGH_SEVERITY.has(defect.blastRadius)) {
      fallbackReasons.set(item.uri, 'STALE_HIGH_SEVERITY');
      continue;
    }
    if (item.value?.stale) operatorNotes.push(`[VIKING_STALE_L1] ${item.uri} used for ${defect.blastRadius} triage.`);
    evidence.set(item.uri, { uri: item.uri, content: item.value?.content, requestedTier: 'L1', resolvedTier: item.value?.resolution_tier ?? 'L1', stale: item.value?.stale ?? false });
  }

  if (fallbackReasons.size > 0) {
    const l2 = await options.client.batchRead([...fallbackReasons.keys()].map((uri) => ({ uri, tier: 'L2' })));
    for (const item of l2.results) {
      const fallbackReason = fallbackReasons.get(item.uri)!;
      if (item.ok) evidence.set(item.uri, { uri: item.uri, content: item.value?.content, requestedTier: 'L1', resolvedTier: 'L2', stale: false, fallbackReason });
      else evidence.set(item.uri, { uri: item.uri, requestedTier: 'L1', fallbackReason, error: { code: item.error?.vikingCode ?? 'INTERNAL_ERROR', message: item.error?.message ?? 'Viking L2 read failed' } });
    }
  }

  return {
    mode: 'viking',
    severity: defect.blastRadius,
    evidence: uris.map((uri) => evidence.get(uri) ?? { uri, requestedTier: 'L1', error: { code: 'MISSING_RESULT', message: 'Viking batch response omitted the resource' } }),
    operatorNotes,
    telemetry: telemetrySnapshot(options.client),
  };
}
