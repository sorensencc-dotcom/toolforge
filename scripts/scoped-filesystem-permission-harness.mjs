#!/usr/bin/env node
/**
 * scripts/scoped-filesystem-permission-harness.mjs
 *
 * Scoped Filesystem Permission Harness for Autonomous Agent Workspaces.
 * Enforces least-privilege capability boundaries, jail containment,
 * and traversal protection for toolforge tools, MCP servers, and subagents.
 */

import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

export const REPO_ROOT = path.resolve(fileURLToPath(import.meta.url), '../..');

export const CRITICAL_DENIED_PATH_PATTERNS = [
  /^[a-zA-Z]:[/\\]windows([/\\]|$)/i,
  /^[a-zA-Z]:[/\\]program files([/\\]|$)/i,
  /^[a-zA-Z]:[/\\]programdata([/\\]|$)/i,
  /[/\\]\.(ssh|aws|gcp|azure|gnupg|credentials)([/\\]|$)/i,
  /[/\\]id_rsa([/\\]|$)/i,
  /[/\\]\.env(\.production|\.local)?$/i,
  /[/\\]\.git[/\\](config|credentials|hooks)([/\\]|$)/i,
  /::\$DATA/i,
  /:Zone\.Identifier/i
];

/**
 * Standardize and canonicalize path for strict Windows & POSIX matching.
 */
export function canonicalizePath(targetPath) {
  if (!targetPath || typeof targetPath !== 'string') return null;

  // Reject null-byte injection
  if (targetPath.includes('\0')) return null;

  // Unescape URL encoded dot-dot sequences
  let decoded = targetPath;
  try {
    decoded = decodeURIComponent(targetPath);
  } catch {}

  // Reject NTFS stream syntax
  if (/:[a-zA-Z0-9_\$]/i.test(decoded) && !/^[a-zA-Z]:[/\\]/i.test(decoded)) {
    return null;
  }

  const normalized = path.normalize(path.resolve(decoded));
  return normalized;
}

/**
 * Check if target path is strictly contained within any allowed root directory.
 */
export function isContainedWithin(targetPath, allowedRoots = []) {
  const normTarget = canonicalizePath(targetPath);
  if (!normTarget) return false;

  const targetLower = normTarget.toLowerCase();

  for (const root of allowedRoots) {
    const normRoot = canonicalizePath(root);
    if (!normRoot) continue;
    const rootLower = normRoot.toLowerCase();

    if (targetLower === rootLower) return true;
    if (targetLower.startsWith(rootLower + path.sep.toLowerCase()) || targetLower.startsWith(rootLower + '/')) {
      return true;
    }
  }

  return false;
}

/**
 * Check if path matches any system-level denied patterns.
 */
export function isSystemDenied(targetPath) {
  const normalized = canonicalizePath(targetPath);
  if (!normalized) return true;

  for (const pattern of CRITICAL_DENIED_PATH_PATTERNS) {
    if (pattern.test(normalized)) {
      return true;
    }
  }
  return false;
}

/**
 * Evaluate requested filesystem operation against the capability policy.
 * @param {string} targetPath Target path to read/write/delete
 * @param {'read'|'write'|'delete'|'exec'} operation Requested operation
 * @param {Object} policy Policy definition { capability: 'read-only'|'workspace-mutate'|'isolated-tmp'|'unrestricted', allowedRoots: string[], deniedPatterns?: RegExp[] }
 * @returns {{ allowed: boolean, canonicalPath: string | null, reason: string | null, violationCode: string | null }}
 */
export function evaluateFilesystemPermission(targetPath, operation = 'read', policy = {}) {
  const {
    capability = 'read-only',
    allowedRoots = [REPO_ROOT],
    deniedPatterns = []
  } = policy;

  const canonical = canonicalizePath(targetPath);
  if (!canonical) {
    return {
      allowed: false,
      canonicalPath: null,
      reason: 'Invalid, malformed, or malicious path sequence (null byte or stream syntax detected)',
      violationCode: 'MALFORMED_PATH'
    };
  }

  // 1. Critical System Path Jail Check
  if (isSystemDenied(canonical)) {
    return {
      allowed: false,
      canonicalPath: canonical,
      reason: `Access to sensitive host or credential path is strictly denied: ${canonical}`,
      violationCode: 'CRITICAL_SYSTEM_PATH_DENIED'
    };
  }

  // 2. Custom Denied Patterns Check
  for (const pattern of deniedPatterns) {
    if (pattern.test(canonical)) {
      return {
        allowed: false,
        canonicalPath: canonical,
        reason: `Matched custom security denial pattern: ${pattern}`,
        violationCode: 'CUSTOM_DENIED_PATTERN'
      };
    }
  }

  // 3. Workspace Jail / Allowed Roots Containment Check
  if (capability !== 'unrestricted') {
    if (!isContainedWithin(canonical, allowedRoots)) {
      return {
        allowed: false,
        canonicalPath: canonical,
        reason: `Target path escapes allowed capability boundaries: ${canonical}`,
        violationCode: 'JAIL_ESCAPE_ATTEMPT'
      };
    }
  }

  // 4. Operation vs Capability Enforcement
  if (capability === 'read-only' && (operation === 'write' || operation === 'delete')) {
    return {
      allowed: false,
      canonicalPath: canonical,
      reason: `Mutation operation (${operation}) blocked by read-only policy`,
      violationCode: 'READ_ONLY_VIOLATION'
    };
  }

  if (capability === 'isolated-tmp' && (operation === 'write' || operation === 'delete')) {
    const isTmp = /[/\\](tmp|temp|scratch|\.tmp)([/\\]|$)/i.test(canonical);
    if (!isTmp) {
      return {
        allowed: false,
        canonicalPath: canonical,
        reason: `Isolated-tmp capability permits mutations only within scratch/temp directories`,
        violationCode: 'TMP_JAIL_VIOLATION'
      };
    }
  }

  return {
    allowed: true,
    canonicalPath: canonical,
    reason: null,
    violationCode: null
  };
}

// CLI Execution Entrypoint
if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const args = process.argv.slice(2);
  const target = args[0] || process.cwd();
  const op = args[1] || 'read';
  const cap = args[2] || 'workspace-mutate';

  const result = evaluateFilesystemPermission(target, op, {
    capability: cap,
    allowedRoots: [REPO_ROOT]
  });

  console.log(JSON.stringify(result, null, 2));
}
