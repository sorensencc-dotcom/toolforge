import * as crypto from 'crypto';

function compactIso(): string {
  return new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');
}

function hex6(): string {
  return crypto.randomBytes(3).toString('hex');
}

export function generateRunId(): string {
  return `run-${compactIso()}-${hex6()}`;
}

export function generateBundleId(): string {
  return `bundle-${compactIso()}-${hex6()}`;
}
