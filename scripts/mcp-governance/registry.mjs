import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);

export const EXIT_CODES = {
  SUCCESS: 0,
  ERR_BUDGET_VIOLATION: 10,
  ERR_AST_PARSE_FAILURE: 20,
  ERR_ATOMIC_WRITE_FAILURE: 30,
  ERR_CLIENT_CONFIG_INVALID: 40,
  ERR_REGISTRY_SCHEMA_INVALID: 50
};

let cachedEncoder = null;

function getEncoder() {
  if (cachedEncoder !== null) return cachedEncoder;
  try {
    const tiktoken = require('C:/dev/kb-sync/node_modules/js-tiktoken');
    cachedEncoder = tiktoken.getEncoding('cl100k_base');
    return cachedEncoder;
  } catch {
    try {
      const tiktoken = require('js-tiktoken');
      cachedEncoder = tiktoken.getEncoding('cl100k_base');
      return cachedEncoder;
    } catch {
      cachedEncoder = false;
      return null;
    }
  }
}

/**
 * Strips comments outside of quotes from a single line.
 */
function stripComment(line) {
  let inQuote = false;
  let quoteChar = '';
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if ((char === '"' || char === "'") && line[i - 1] !== '\\') {
      if (!inQuote) {
        inQuote = true;
        quoteChar = char;
      } else if (quoteChar === char) {
        inQuote = false;
        quoteChar = '';
      }
    } else if (char === '#' && !inQuote) {
      return line.slice(0, i);
    }
  }
  return line;
}

/**
 * Robust lightweight TOML parser for MCP registry structures.
 */
export function parseToml(content) {
  const lines = content.split(/\r?\n/);
  const result = {
    profiles: {},
    servers: {}
  };
  let currentPath = [];

  for (let i = 0; i < lines.length; i++) {
    const rawLine = lines[i];
    const stripped = stripComment(rawLine).trim();

    if (!stripped) {
      continue;
    }

    // Section header: [section], [section.subkey], [servers.ironledger.env]
    const headerMatch = stripped.match(/^\[([a-zA-Z0-9_\.-]+)\]$/);
    if (headerMatch) {
      currentPath = headerMatch[1].split('.');
      let ptr = result;
      for (const seg of currentPath) {
        if (!ptr[seg] || typeof ptr[seg] !== 'object') {
          ptr[seg] = {};
        }
        ptr = ptr[seg];
      }
      continue;
    }

    // Key-value pair: key = value
    const kvMatch = stripped.match(/^([a-zA-Z0-9_-]+)\s*=\s*(.+)$/);
    if (kvMatch) {
      const key = kvMatch[1].trim();
      let rawVal = kvMatch[2].trim();

      let parsedVal;
      if (rawVal.startsWith('"') && rawVal.endsWith('"')) {
        parsedVal = rawVal.slice(1, -1);
      } else if (rawVal.startsWith("'") && rawVal.endsWith("'")) {
        parsedVal = rawVal.slice(1, -1);
      } else if (rawVal.startsWith('[') && rawVal.endsWith(']')) {
        // Parse array of strings/items
        const inner = rawVal.slice(1, -1).trim();
        if (!inner) {
          parsedVal = [];
        } else {
          parsedVal = inner.split(',').map(item => {
            const t = item.trim();
            if (t.startsWith('"') && t.endsWith('"')) return t.slice(1, -1);
            if (t.startsWith("'") && t.endsWith("'")) return t.slice(1, -1);
            return t;
          }).filter(Boolean);
        }
      } else if (/^-?\d+$/.test(rawVal)) {
        parsedVal = parseInt(rawVal, 10);
      } else if (/^-?\d+\.\d+$/.test(rawVal)) {
        parsedVal = parseFloat(rawVal);
      } else if (rawVal === 'true') {
        parsedVal = true;
      } else if (rawVal === 'false') {
        parsedVal = false;
      } else {
        parsedVal = rawVal;
      }

      if (currentPath.length > 0) {
        let ptr = result;
        for (let j = 0; j < currentPath.length; j++) {
          const seg = currentPath[j];
          if (!ptr[seg] || typeof ptr[seg] !== 'object') {
            ptr[seg] = {};
          }
          ptr = ptr[seg];
        }
        ptr[key] = parsedVal;
      } else {
        result[key] = parsedVal;
      }
      continue;
    }

    const err = new Error(`Invalid TOML line: ${rawLine.trim()}`);
    err.exitCode = EXIT_CODES.ERR_AST_PARSE_FAILURE;
    throw err;
  }

  return result;
}

/**
 * Loads and parses canonical MCP registry TOML file.
 */
export function loadRegistry(filePath) {
  if (!fs.existsSync(filePath)) {
    const err = new Error(`Registry file not found at ${filePath}`);
    err.code = 'ENOENT';
    err.exitCode = EXIT_CODES.ERR_REGISTRY_SCHEMA_INVALID;
    throw err;
  }

  const raw = fs.readFileSync(filePath, 'utf8');
  try {
    const parsed = parseToml(raw);
    if (!parsed.profiles || !parsed.servers) {
      const err = new Error('Invalid registry: missing profiles or servers table');
      err.exitCode = EXIT_CODES.ERR_REGISTRY_SCHEMA_INVALID;
      throw err;
    }
    return parsed;
  } catch (e) {
    if (!e.exitCode) {
      e.exitCode = EXIT_CODES.ERR_AST_PARSE_FAILURE;
    }
    throw e;
  }
}

/**
 * Calculates exact or estimated token weight of a serialized tool schema.
 */
export function calculateSchemaTokens(toolSchemaJson) {
  const jsonStr = typeof toolSchemaJson === 'string' ? toolSchemaJson : JSON.stringify(toolSchemaJson);
  const encoder = getEncoder();
  if (encoder) {
    return encoder.encode(jsonStr).length;
  }
  return Math.ceil(jsonStr.length / 3.8);
}

/**
 * Validates profile token budgets, tool counts, and server references.
 */
export function validateBudgets(registry, customTokenCounts = {}) {
  const errors = [];
  const profileStats = {};

  if (!registry || !registry.profiles) {
    return {
      valid: false,
      exitCode: EXIT_CODES.ERR_REGISTRY_SCHEMA_INVALID,
      errors: ['Missing profiles in registry'],
      profileStats: {}
    };
  }

  for (const [profileName, profile] of Object.entries(registry.profiles)) {
    const serverList = profile.servers || [];
    const toolCount = serverList.length;
    const maxTools = profile.max_tools || 50;
    const maxTokens = profile.max_schema_tokens || 45000;

    let totalTokens = 0;
    for (const sName of serverList) {
      const serverDef = registry.servers ? registry.servers[sName] : null;
      if (!serverDef) {
        errors.push(`Profile '${profileName}' references undefined server '${sName}'`);
        continue;
      }
      const weight = customTokenCounts[sName] !== undefined
        ? customTokenCounts[sName]
        : (serverDef.schema_weight || 1000);
      totalTokens += weight;
    }

    if (toolCount > maxTools) {
      errors.push(`Profile '${profileName}' exceeds max_tools limit (${toolCount} > ${maxTools})`);
    }

    if (totalTokens > maxTokens) {
      errors.push(`Profile '${profileName}' exceeds max_schema_tokens budget (${totalTokens} > ${maxTokens})`);
    }

    const headroomTokens = maxTokens - totalTokens;
    profileStats[profileName] = {
      profile: profileName,
      toolCount,
      maxTools,
      totalTokens,
      maxTokens,
      headroomTokens,
      status: (toolCount <= maxTools && totalTokens <= maxTokens) ? 'OK' : 'OVER_BUDGET'
    };
  }

  const valid = errors.length === 0;
  let exitCode = EXIT_CODES.SUCCESS;
  if (!valid) {
    const hasBudgetError = errors.some(e => e.includes('max_tools') || e.includes('max_schema_tokens'));
    const hasSchemaError = errors.some(e => e.includes('undefined server') || e.includes('Missing'));
    if (hasBudgetError) {
      exitCode = EXIT_CODES.ERR_BUDGET_VIOLATION;
    } else if (hasSchemaError) {
      exitCode = EXIT_CODES.ERR_REGISTRY_SCHEMA_INVALID;
    } else {
      exitCode = EXIT_CODES.ERR_BUDGET_VIOLATION;
    }
  }

  return {
    valid,
    exitCode,
    errors,
    profileStats
  };
}
