import fs from 'node:fs';
import path from 'node:path';
import { EXIT_CODES } from './registry.mjs';

export { EXIT_CODES };

/**
 * Normalizes activeServers into a plain object dictionary.
 */
function normalizeServers(activeServers) {
  if (!activeServers) return {};
  if (activeServers instanceof Map) {
    return Object.fromEntries(activeServers.entries());
  }
  if (Array.isArray(activeServers)) {
    const obj = {};
    for (const item of activeServers) {
      if (item && typeof item === 'object') {
        const key = item.name || item.id || item.serverName;
        if (key) obj[key] = item;
      }
    }
    return obj;
  }
  if (typeof activeServers === 'object') {
    return activeServers;
  }
  return {};
}

/**
 * Detects indentation pattern in existing JSON string.
 */
function detectJsonIndent(jsonString) {
  const match = jsonString.match(/^[ \t]+(?="|\w)/m);
  return match ? match[0] : 2;
}

/**
 * Formats a server definition for JSON-based MCP client configs.
 * Filters out internal registry metadata (schema_weight, tags, transport).
 */
function formatServerForJson(serverDef) {
  const formatted = {};
  if (serverDef.command) {
    formatted.command = serverDef.command;
  }
  if (Array.isArray(serverDef.args)) {
    formatted.args = serverDef.args;
  }
  if (serverDef.env && typeof serverDef.env === 'object' && Object.keys(serverDef.env).length > 0) {
    formatted.env = serverDef.env;
  }
  if (serverDef.url) {
    formatted.url = serverDef.url;
  }
  if (serverDef.bearer_token_env_var) {
    formatted.bearer_token_env_var = serverDef.bearer_token_env_var;
  }
  if (serverDef.enabled !== undefined) {
    formatted.enabled = serverDef.enabled;
  }

  // Preserve any other custom non-internal keys
  for (const [k, v] of Object.entries(serverDef)) {
    if (['command', 'args', 'env', 'url', 'bearer_token_env_var', 'enabled', 'schema_weight', 'tags', 'transport'].includes(k)) {
      continue;
    }
    formatted[k] = v;
  }

  return formatted;
}

/**
 * Formats a server definition for TOML (Codex ~/.codex/config.toml).
 */
function formatServerForToml(serverName, serverDef) {
  const lines = [];
  const safeHeader = /^[a-zA-Z0-9_-]+$/.test(serverName)
    ? `mcp_servers.${serverName}`
    : `mcp_servers.${JSON.stringify(serverName)}`;

  lines.push(`[${safeHeader}]`);

  if (serverDef.command) {
    lines.push(`command = ${JSON.stringify(serverDef.command)}`);
  }
  if (Array.isArray(serverDef.args)) {
    const formattedArgs = serverDef.args.map(a => JSON.stringify(a)).join(', ');
    lines.push(`args = [${formattedArgs}]`);
  }
  if (serverDef.url) {
    lines.push(`url = ${JSON.stringify(serverDef.url)}`);
  }
  if (serverDef.bearer_token_env_var) {
    lines.push(`bearer_token_env_var = ${JSON.stringify(serverDef.bearer_token_env_var)}`);
  }
  if (serverDef.enabled !== undefined) {
    lines.push(`enabled = ${serverDef.enabled ? 'true' : 'false'}`);
  }

  // Preserve other scalar / array settings
  for (const [k, v] of Object.entries(serverDef)) {
    if (['command', 'args', 'url', 'bearer_token_env_var', 'enabled', 'env', 'schema_weight', 'tags', 'transport'].includes(k)) {
      continue;
    }
    if (typeof v === 'string') {
      lines.push(`${k} = ${JSON.stringify(v)}`);
    } else if (typeof v === 'boolean' || typeof v === 'number') {
      lines.push(`${k} = ${v}`);
    } else if (Array.isArray(v)) {
      lines.push(`${k} = [${v.map(i => JSON.stringify(i)).join(', ')}]`);
    }
  }

  // Env subtable
  if (serverDef.env && typeof serverDef.env === 'object' && Object.keys(serverDef.env).length > 0) {
    lines.push('');
    lines.push(`[${safeHeader}.env]`);
    for (const [ek, ev] of Object.entries(serverDef.env)) {
      lines.push(`${ek} = ${JSON.stringify(String(ev))}`);
    }
  }

  return lines.join('\n');
}

/**
 * Surgically compiles Codex config.toml by replacing only [mcp_servers] blocks.
 * Preserves comments, model configuration, telemetry, plugins, and all non-MCP settings.
 */
export function compileCodexToml(existingContent, activeServers = {}) {
  const servers = normalizeServers(activeServers);
  const lines = (existingContent || '').split(/\r?\n/);
  const nonMcpLines = [];
  let inMcpBlock = false;
  let firstMcpIndex = -1;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const headerMatch = line.match(/^\s*\[{1,2}\s*([^\]]+?)\s*\]{1,2}\s*(?:#.*)?$/);

    if (headerMatch) {
      const header = headerMatch[1].trim();
      const isMcp = /^(?:"mcp_servers"|'mcp_servers'|mcp_servers)(?:\.|$)/.test(header);
      if (isMcp) {
        inMcpBlock = true;
        if (firstMcpIndex === -1) {
          firstMcpIndex = nonMcpLines.length;
        }
        continue;
      } else {
        inMcpBlock = false;
      }
    }

    if (inMcpBlock) {
      // Line is inside an mcp_servers table; skip it
      continue;
    }

    nonMcpLines.push(line);
  }

  // Build new MCP servers blocks
  const tomlBlocks = [];
  for (const [name, def] of Object.entries(servers)) {
    const block = formatServerForToml(name, def);
    if (block) {
      tomlBlocks.push(block);
    }
  }
  const newMcpContent = tomlBlocks.join('\n\n');

  let result;
  if (tomlBlocks.length === 0) {
    // If no active servers, clean up consecutive blank lines
    result = nonMcpLines.join('\n').replace(/\n{3,}/g, '\n\n').trim();
    if (result.length > 0) result += '\n';
  } else if (firstMcpIndex === -1) {
    // No previous MCP block existed, append at end
    const base = nonMcpLines.join('\n').trim();
    result = base.length > 0 ? `${base}\n\n${newMcpContent}\n` : `${newMcpContent}\n`;
  } else {
    // Insert at firstMcpIndex
    const before = nonMcpLines.slice(0, firstMcpIndex).join('\n').trim();
    const after = nonMcpLines.slice(firstMcpIndex).join('\n').trim();

    if (before.length > 0 && after.length > 0) {
      result = `${before}\n\n${newMcpContent}\n\n${after}\n`;
    } else if (before.length > 0) {
      result = `${before}\n\n${newMcpContent}\n`;
    } else if (after.length > 0) {
      result = `${newMcpContent}\n\n${after}\n`;
    } else {
      result = `${newMcpContent}\n`;
    }
  }

  return result;
}

/**
 * Generic helper for JSON-based client configuration compilation.
 */
function compileJsonClientConfig(existingContent, activeServers, clientName = 'client') {
  const servers = normalizeServers(activeServers);
  let parsed = {};
  let indent = 2;

  if (existingContent && existingContent.trim().length > 0) {
    try {
      parsed = JSON.parse(existingContent);
    } catch (e) {
      const err = new Error(`Failed to parse ${clientName} JSON: ${e.message}`);
      err.exitCode = EXIT_CODES.ERR_AST_PARSE_FAILURE;
      err.code = 'ERR_AST_PARSE_FAILURE';
      throw err;
    }
    indent = detectJsonIndent(existingContent);
  }

  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    const err = new Error(`Invalid ${clientName} JSON: root must be an object`);
    err.exitCode = EXIT_CODES.ERR_CLIENT_CONFIG_INVALID;
    err.code = 'ERR_CLIENT_CONFIG_INVALID';
    throw err;
  }

  const formattedServers = {};
  for (const [name, def] of Object.entries(servers)) {
    formattedServers[name] = formatServerForJson(def);
  }

  parsed.mcpServers = formattedServers;

  return JSON.stringify(parsed, null, indent) + '\n';
}

/**
 * Surgically compiles Claude Code configuration (~/.claude.json).
 * Preserves top-level user keys and detected indentation.
 */
export function compileClaudeJson(existingContent, activeServers = {}) {
  return compileJsonClientConfig(existingContent, activeServers, 'Claude');
}

/**
 * Surgically compiles Claude Desktop configuration (claude_desktop_config.json).
 * Preserves top-level user preferences, cowork paths, and detected indentation.
 */
export function compileDesktopJson(existingContent, activeServers = {}) {
  return compileJsonClientConfig(existingContent, activeServers, 'Claude Desktop');
}

/**
 * Formats servers for Grok bot / Sigil bridge configuration (config.json).
 */
export function compileGrokBridge(existingContent, activeServers = {}) {
  return compileJsonClientConfig(existingContent, activeServers, 'Grok Bridge');
}

/**
 * Performs atomic file write with backup and rollback on failure.
 * 1. Creates `<file>.bak` if `<file>` exists.
 * 2. Writes content to `<file>.tmp.<timestamp>`.
 * 3. Atomically renames `.tmp` -> `<file>`.
 * 4. On any failure, restores from `.bak` and throws with ERR_ATOMIC_WRITE_FAILURE (exit code 30).
 */
export function atomicWriteWithBackup(filePath, newContent) {
  if (!filePath || typeof filePath !== 'string') {
    const err = new Error('Invalid filePath provided to atomicWriteWithBackup');
    err.exitCode = EXIT_CODES.ERR_ATOMIC_WRITE_FAILURE;
    err.code = 'ERR_ATOMIC_WRITE_FAILURE';
    throw err;
  }

  const resolvedPath = path.resolve(filePath);
  const dir = path.dirname(resolvedPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  let fileExists = false;
  try {
    const stats = fs.statSync(resolvedPath);
    if (stats.isDirectory()) {
      const err = new Error(`Target path is a directory, not a file: ${resolvedPath}`);
      err.exitCode = EXIT_CODES.ERR_ATOMIC_WRITE_FAILURE;
      err.code = 'ERR_ATOMIC_WRITE_FAILURE';
      throw err;
    }
    fileExists = true;
  } catch (e) {
    if (e.code !== 'ENOENT') {
      const err = new Error(`Cannot access target path ${resolvedPath}: ${e.message}`);
      err.exitCode = EXIT_CODES.ERR_ATOMIC_WRITE_FAILURE;
      err.code = 'ERR_ATOMIC_WRITE_FAILURE';
      throw err;
    }
  }

  let backupPath = null;
  if (fileExists) {
    backupPath = `${resolvedPath}.bak`;
    try {
      fs.copyFileSync(resolvedPath, backupPath);
    } catch (e) {
      const err = new Error(`Failed to create backup at ${backupPath}: ${e.message}`);
      err.exitCode = EXIT_CODES.ERR_ATOMIC_WRITE_FAILURE;
      err.code = 'ERR_ATOMIC_WRITE_FAILURE';
      throw err;
    }
  }

  const tmpPath = `${resolvedPath}.tmp.${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

  try {
    fs.writeFileSync(tmpPath, newContent, 'utf8');
    fs.renameSync(tmpPath, resolvedPath);
    return {
      success: true,
      backupPath,
      targetPath: resolvedPath
    };
  } catch (e) {
    // Cleanup temporary file
    try {
      if (fs.existsSync(tmpPath)) {
        fs.unlinkSync(tmpPath);
      }
    } catch {}

    // Restore from backup if backup was created
    if (fileExists && backupPath && fs.existsSync(backupPath)) {
      try {
        fs.copyFileSync(backupPath, resolvedPath);
      } catch {}
    }

    const err = new Error(`Atomic write failed for ${resolvedPath}: ${e.message}`);
    err.exitCode = EXIT_CODES.ERR_ATOMIC_WRITE_FAILURE;
    err.code = 'ERR_ATOMIC_WRITE_FAILURE';
    err.cause = e;
    throw err;
  }
}
