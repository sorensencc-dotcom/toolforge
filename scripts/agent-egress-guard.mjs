/**
 * scripts/agent-egress-guard.mjs
 *
 * Pre-Tool Egress Gatekeeper & Intermediate Storage Exfiltration Guard.
 * Enforces strict sandbox egress policies across agent runtimes (Antigravity, Claude Code, bots).
 *
 * Capabilities:
 * 1. Destination Whitelisting: Enforces permitted API domains (GitHub, Google, Notion, Slack, Loopback).
 * 2. Intermediate Storage Protection: Detects and halts attempts to transmit scratchpad/harness files (.harness/, .ijfw/, trm-drive/, _status-feed/).
 * 3. Command & Payload Inspection: Parses shell invocations (curl, wget, Invoke-RestMethod, etc.) and structured tool parameters.
 *
 * Zero token footprint.
 */

import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const DEFAULT_ALLOWED_HOSTS = [
  'localhost',
  '127.0.0.1',
  '::1',
  '0.0.0.0',
  'github.com',
  'api.github.com',
  'raw.githubusercontent.com',
  'googleapis.com',
  '*.googleapis.com',
  'generativelanguage.googleapis.com',
  'docs.google.com',
  'drive.google.com',
  'notion.so',
  'api.notion.com',
  'slack.com',
  '*.slack.com'
];

export const SENSITIVE_STORAGE_PATTERNS = [
  /\.harness[/\\]tasks/i,
  /_status-feed[/\\]/i,
  /trm-drive[/\\]inbox/i,
  /\.ijfw[/\\]/i,
  /\.gemini[/\\]antigravity/i,
  /\.claude[/\\]/i,
  /\.env(\.local|\.production|\.development)?$/i,
  /credentials\.json/i,
  /id_rsa/i,
  /token/i
];

export const EGRESS_COMMAND_PATTERNS = [
  { tool: 'curl', regex: /curl\s+.*?(?:-X\s+(POST|PUT|PATCH)|--data|-d|--form|-F|-T|--upload-file)\s+/i },
  { tool: 'wget', regex: /wget\s+.*?(?:--post-data|--post-file)\s+/i },
  { tool: 'pwsh-rest', regex: /(?:Invoke-RestMethod|Invoke-WebRequest|irm|iwr)\s+.*?-Method\s+(POST|PUT|PATCH)/i },
  { tool: 'fetch', regex: /fetch\s*\(\s*['"`]([^'"`]+)['"`]\s*,\s*\{[^}]*method\s*:\s*['"`](POST|PUT|PATCH)['"`]/i }
];

/**
 * Validates if a given hostname matches the whitelist.
 * Supports wildcard matching (e.g. *.googleapis.com).
 *
 * @param {string} host Hostname or IP to validate
 * @param {string[]} [allowedHosts] Optional custom whitelist
 * @returns {boolean}
 */
export function isAllowedHost(host, allowedHosts = DEFAULT_ALLOWED_HOSTS) {
  if (!host) return false;
  const cleanHost = host.toLowerCase().trim().replace(/:\d+$/, '');

  for (const allowed of allowedHosts) {
    const cleanAllowed = allowed.toLowerCase().trim();
    if (cleanAllowed === cleanHost) return true;
    if (cleanAllowed.startsWith('*.')) {
      const rootDomain = cleanAllowed.slice(2);
      if (cleanHost === rootDomain || cleanHost.endsWith('.' + rootDomain)) {
        return true;
      }
    }
  }
  return false;
}

/**
 * Extracts target URL and host from a command string or URL input.
 *
 * @param {string} raw Target URL or command line string
 * @returns {{ url: string|null, host: string|null, method: string }}
 */
export function extractEgressTarget(raw) {
  if (!raw || typeof raw !== 'string') {
    return { url: null, host: null, method: 'GET' };
  }

  // Check if raw is already a valid URL
  try {
    const parsed = new URL(raw);
    return { url: parsed.href, host: parsed.hostname, method: 'GET' };
  } catch {}

  // Extract from command line: find http(s):// URL
  const urlMatch = raw.match(/https?:\/\/[^\s"'>)]+/i);
  const url = urlMatch ? urlMatch[0] : null;
  let host = null;
  if (url) {
    try {
      host = new URL(url).hostname;
    } catch {}
  }

  // Extract HTTP method if present
  let method = 'GET';
  const methodMatch = raw.match(/(?:-X|--request|-Method)\s+['"]?(POST|PUT|PATCH|DELETE|GET|HEAD)['"]?/i);
  if (methodMatch) {
    method = methodMatch[1].toUpperCase();
  } else if (raw.match(/(?:--data|-d|--form|-F|--post-data|--post-file)\s+/i)) {
    method = 'POST';
  }

  return { url, host, method };
}

/**
 * Checks if payload text or command arguments reference sensitive storage paths.
 *
 * @param {string|Object} payload Command string, body, or file arguments
 * @returns {{ hasSensitiveData: boolean, matchedPatterns: string[] }}
 */
export function scanSensitiveStorageReferences(payload) {
  if (!payload) return { hasSensitiveData: false, matchedPatterns: [] };
  const text = typeof payload === 'string' ? payload : JSON.stringify(payload);

  const matches = [];
  for (const pattern of SENSITIVE_STORAGE_PATTERNS) {
    if (pattern.test(text)) {
      matches.push(pattern.toString());
    }
  }

  return {
    hasSensitiveData: matches.length > 0,
    matchedPatterns: matches
  };
}

/**
 * Main evaluation entry point for pre-tool egress verification.
 *
 * @param {Object|string} input Object containing { url, method, body, command, headers } or command string
 * @param {Object} [options]
 * @param {string[]} [options.allowedHosts] Custom host whitelist
 * @returns {{
 *   verdict: 'ALLOWED' | 'BLOCKED' | 'SECURITY_HALT',
 *   destination: string | null,
 *   isWhitelisted: boolean,
 *   hasSensitiveStorageRef: boolean,
 *   reason: string,
 *   rule: string
 * }}
 */
export function evaluateEgressSafety(input, options = {}) {
  const allowedHosts = options.allowedHosts || DEFAULT_ALLOWED_HOSTS;

  let rawCommand = null;
  let url = null;
  let method = 'GET';
  let body = null;

  if (typeof input === 'string') {
    rawCommand = input;
    const extracted = extractEgressTarget(input);
    url = extracted.url;
    method = extracted.method;
    body = input;
  } else if (typeof input === 'object' && input !== null) {
    rawCommand = input.command || null;
    url = input.url || null;
    method = (input.method || 'GET').toUpperCase();
    body = input.body || input.data || null;

    if (!url && rawCommand) {
      const extracted = extractEgressTarget(rawCommand);
      url = extracted.url;
      if (input.method === undefined) method = extracted.method;
    }
  } else {
    return {
      verdict: 'BLOCKED',
      destination: null,
      isWhitelisted: false,
      hasSensitiveStorageRef: false,
      reason: 'Invalid input envelope to egress guard',
      rule: 'EGRESS_INVALID_INPUT'
    };
  }

  // If no URL or outbound network action is detected, allow local execution
  if (!url) {
    const isEgressCommand = EGRESS_COMMAND_PATTERNS.some(p => rawCommand && p.regex.test(rawCommand));
    if (!isEgressCommand) {
      return {
        verdict: 'ALLOWED',
        destination: null,
        isWhitelisted: true,
        hasSensitiveStorageRef: false,
        reason: 'No outbound network call detected in command',
        rule: 'EGRESS_NO_NETWORK'
      };
    }
  }

  let host = null;
  if (url) {
    try {
      host = new URL(url).hostname;
    } catch {
      return {
        verdict: 'BLOCKED',
        destination: url,
        isWhitelisted: false,
        hasSensitiveStorageRef: false,
        reason: `Malformed destination URL: ${url}`,
        rule: 'EGRESS_MALFORMED_URL'
      };
    }
  }

  const isWhitelisted = isAllowedHost(host, allowedHosts);
  const sensitiveScan = scanSensitiveStorageReferences(body || rawCommand);
  const isMutatingEgress = ['POST', 'PUT', 'PATCH', 'DELETE'].includes(method);

  // Critical Safety Halt: Attempting to exfiltrate intermediate storage or secrets to non-whitelisted destinations
  if (!isWhitelisted && sensitiveScan.hasSensitiveData && isMutatingEgress) {
    return {
      verdict: 'SECURITY_HALT',
      destination: host || url,
      isWhitelisted: false,
      hasSensitiveStorageRef: true,
      reason: `Attempted exfiltration of intermediate scratchpad/secrets to unwhitelisted host: ${host || url} (Matched: ${sensitiveScan.matchedPatterns.join(', ')})`,
      rule: 'EGRESS_STORAGE_EXFILTRATION_HALT'
    };
  }

  // Block any non-whitelisted outbound network connection
  if (!isWhitelisted) {
    return {
      verdict: 'BLOCKED',
      destination: host || url,
      isWhitelisted: false,
      hasSensitiveStorageRef: sensitiveScan.hasSensitiveData,
      reason: `Outbound network destination is not whitelisted: ${host || url}`,
      rule: 'EGRESS_UNWHITELISTED_HOST'
    };
  }

  // Allowed whitelisted call
  return {
    verdict: 'ALLOWED',
    destination: host,
    isWhitelisted: true,
    hasSensitiveStorageRef: sensitiveScan.hasSensitiveData,
    reason: `Destination ${host} is on the authorized governance whitelist`,
    rule: 'EGRESS_WHITELIST_PASS'
  };
}

// CLI Execution Support
if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url))) {
  const args = process.argv.slice(2);
  const evalIdx = args.indexOf('--eval');
  const target = evalIdx !== -1 ? args[evalIdx + 1] : args[0];

  if (!target) {
    console.log(`Usage: node scripts/agent-egress-guard.mjs --eval "<command_or_url>"`);
    process.exit(1);
  }

  const result = evaluateEgressSafety(target);
  console.log(JSON.stringify(result, null, 2));

  if (result.verdict === 'SECURITY_HALT') {
    console.error(`🛑 [SECURITY HALT] Egress violation: ${result.reason}`);
    process.exit(2);
  } else if (result.verdict === 'BLOCKED') {
    console.warn(`⚠️ [EGRESS BLOCKED] ${result.reason}`);
    process.exit(1);
  } else {
    console.log(`✅ [EGRESS ALLOWED] ${result.reason}`);
    process.exit(0);
  }
}
