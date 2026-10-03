import test from 'node:test';
import assert from 'node:assert/strict';
import { extractL0Abstract, extractL1Skeleton } from './viking-ast-skeleton.mjs';

test('extractL0Abstract extracts single-line purpose and exported symbols from JS/TS', () => {
  const code = `/**
 * Core authentication and token validation module.
 * Provides JWT validation and session renewal.
 */
import crypto from 'node:crypto';

export function authenticate(user, token) {
  return true;
}

export class SessionManager {
  startSession() {}
}

export const DEFAULT_TIMEOUT = 3600;
export default function login() {}
`;

  const l0 = extractL0Abstract(code, '.js');
  assert.equal(typeof l0.abstract, 'string');
  assert.match(l0.abstract, /Core authentication and token validation module/i);
  assert.ok(!l0.abstract.includes('\n'), 'abstract must be single-line');
  assert.ok(Array.isArray(l0.exportedSymbols));
  assert.ok(l0.exportedSymbols.includes('authenticate'));
  assert.ok(l0.exportedSymbols.includes('SessionManager'));
  assert.ok(l0.exportedSymbols.includes('DEFAULT_TIMEOUT'));
  assert.ok(l0.exportedSymbols.includes('login') || l0.exportedSymbols.includes('default'));
});

test('extractL0Abstract extracts TS types and interfaces as exported symbols', () => {
  const tsCode = `// Viking VFS Resolver Types
export interface ResolverConfig {
  vaultRoot: string;
  vaultName: string;
}

export type TierLevel = 'L0' | 'L1' | 'L2';

export const createResolver = (config: ResolverConfig) => {
  return { config };
};
`;

  const l0 = extractL0Abstract(tsCode, '.ts');
  assert.match(l0.abstract, /Viking VFS Resolver Types/i);
  assert.ok(l0.exportedSymbols.includes('ResolverConfig'));
  assert.ok(l0.exportedSymbols.includes('TierLevel'));
  assert.ok(l0.exportedSymbols.includes('createResolver'));
});

test('extractL0Abstract extracts title and outline for markdown', () => {
  const md = `# Architecture Overview

This document describes the high-level architecture.

## Storage Layer
Details on storage.

## API Gateway
Details on gateway.
`;

  const l0 = extractL0Abstract(md, '.md');
  assert.match(l0.abstract, /Architecture Overview/i);
  assert.ok(!l0.abstract.includes('\n'));
  assert.ok(Array.isArray(l0.exportedSymbols));
  assert.ok(l0.exportedSymbols.some((s) => s.includes('Storage Layer')));
  assert.ok(l0.exportedSymbols.some((s) => s.includes('API Gateway')));
});

test('extractL1Skeleton strips JS function and method bodies with skeleton error', () => {
  const code = `export function computeTotal(items) {
  const sum = items.reduce((acc, x) => acc + x.price, 0);
  console.log("Calculated:", sum);
  return sum;
}

export class Calculator {
  multiply(a, b) {
    return a * b;
  }
}
`;

  const skeleton = extractL1Skeleton(code, '.js');
  assert.ok(skeleton.includes('[COMPACTED SKELETON: IMPLEMENTATION STRIPPED - DO NOT EXECUTE]'));
  assert.ok(!skeleton.includes('items.reduce'));
  assert.ok(!skeleton.includes('Calculated:'));
  assert.ok(!skeleton.includes('return a * b;'));
  assert.ok(skeleton.includes('function computeTotal(items)'));
  assert.ok(skeleton.includes('class Calculator'));
  assert.ok(skeleton.includes('multiply(a, b)'));
});

test('extractL1Skeleton preserves TS signatures and interfaces while stripping bodies', () => {
  const tsCode = `export interface QueryOptions {
  limit: number;
}

export abstract class BaseService {
  abstract ping(): void;

  execute<T>(query: string, opts?: QueryOptions): Promise<T> {
    const payload = JSON.stringify({ query, opts });
    return fetch(payload);
  }
}
`;

  const skeleton = extractL1Skeleton(tsCode, '.ts');
  assert.ok(skeleton.includes('interface QueryOptions'));
  assert.ok(skeleton.includes('abstract ping(): void'));
  assert.ok(skeleton.includes('execute<T>'));
  assert.ok(skeleton.includes('[COMPACTED SKELETON: IMPLEMENTATION STRIPPED - DO NOT EXECUTE]'));
  assert.ok(!skeleton.includes('JSON.stringify'));
  assert.ok(!skeleton.includes('fetch(payload)'));
});

test('extractL1Skeleton generates markdown outline for non-code files', () => {
  const md = `# Document Title
Introductory text that is long and detailed.

## Section 1: Setup
Follow these steps carefully:
1. Run install
2. Run build

### Subsection 1.1: Prereqs
Check node version.

## Section 2: Verification
Run tests.
`;

  const skeleton = extractL1Skeleton(md, '.md');
  assert.ok(skeleton.includes('# Document Title'));
  assert.ok(skeleton.includes('## Section 1: Setup'));
  assert.ok(skeleton.includes('### Subsection 1.1: Prereqs'));
  assert.ok(skeleton.includes('## Section 2: Verification'));
  assert.ok(!skeleton.includes('Introductory text that is long'));
});

test('extractL1Skeleton safely falls back on parse errors without crashing', () => {
  const brokenCode = `export function broken( {
    this is completely invalid typescript / javascript syntax !!! @@@ %%%
`;

  const skeleton = extractL1Skeleton(brokenCode, '.ts');
  assert.equal(typeof skeleton, 'string');
  assert.ok(skeleton.length > 0);
});
