export type VikingTier = 'L0' | 'L1' | 'L2';
export type VikingSeverity = 'P0' | 'P1' | 'P2' | 'P3' | 'P4';
export interface VikingTransport { request(method: string, params?: Record<string, unknown>): Promise<any>; close?(): Promise<void>; }
export interface VikingReadResult { uri: string; resolution_tier: VikingTier; snapshot_id: string; stale: boolean; sha256: string; content: string; }
export class VikingRpcError extends Error { code: number; data: Record<string, unknown>; vikingCode: string; }
export class VikingTelemetryTracker { constructor(options?: { sink?: (event: Record<string, unknown>) => void }); record(event: Record<string, unknown>): Record<string, unknown>; events(): Record<string, unknown>[]; snapshot(): Record<string, number>; }
export class VikingClient {
  constructor(options: { transport: VikingTransport; telemetry?: VikingTelemetryTracker; tokenCounter?: (content: string) => number });
  readonly telemetry: VikingTelemetryTracker;
  connect(): Promise<void>;
  list(uri: string, options?: { offset?: number; limit?: number }): Promise<any>;
  listResources(options?: { cursor?: string }): Promise<any>;
  stat(uri: string): Promise<any>;
  read(uri: string, tier?: VikingTier): Promise<VikingReadResult>;
  batchRead(items: Array<{ uri: string; tier?: VikingTier; resolution_tier?: VikingTier }>, options?: { maxTotalBytes?: number }): Promise<any>;
  readWithPolicy(uri: string, policy?: { preferredTier?: VikingTier; severity?: VikingSeverity; fallbackOnUnavailable?: boolean }): Promise<VikingReadResult & { requestedTier: VikingTier; resolvedTier: VikingTier; fallbackTier: VikingTier | null; fallbackReason: string | null; escalated: boolean; warnings: Array<Record<string, unknown>> }>;
  close(): Promise<void>;
}
export function createStdioTransport(options: { command: string; args?: string[]; cwd?: string; env?: Record<string, string>; timeoutMs?: number; onStderr?: (chunk: string) => void }): VikingTransport;
export function parseVikingUri(uri: string): { vault: string; layer: string; relativePath: string; uri: string };
export function formatVikingUri(input: { vault: string; layer: string; relativePath?: string }): string;
export function isVikingError(error: unknown, code: string): boolean;
export function normalizeRpcError(error: unknown): VikingRpcError;

