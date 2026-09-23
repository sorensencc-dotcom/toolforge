#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
import {
  loadRegistry,
  validateBudgets,
  calculateSchemaTokens,
  EXIT_CODES
} from './registry.mjs';
import {
  compileCodexToml,
  compileClaudeJson,
  compileDesktopJson,
  compileGrokBridge,
  atomicWriteWithBackup
} from './compilers.mjs';

export { EXIT_CODES };

export const CLIENT_METADATA = {
  codex: {
    key: 'codex',
    displayName: 'Codex CLI',
    compiler: 'toml',
    defaultProfile: 'dev'
  },
  claude: {
    key: 'claude',
    displayName: 'Claude CLI',
    compiler: 'claudeJson',
    defaultProfile: 'dev'
  },
  desktop: {
    key: 'desktop',
    displayName: 'Claude Desktop',
    compiler: 'desktopJson',
    defaultProfile: 'full'
  },
  antigravity: {
    key: 'antigravity',
    displayName: 'Antigravity',
    compiler: 'claudeJson',
    defaultProfile: 'full'
  },
  grok: {
    key: 'grok',
    displayName: 'Grok',
    compiler: 'grokBridge',
    defaultProfile: 'dev-minimal'
  }
};

export const DEFAULT_CLIENT_PROFILES = {
  codex: 'dev',
  claude: 'dev',
  desktop: 'full',
  antigravity: 'full',
  grok: 'dev-minimal'
};

const DEFAULT_REGISTRY_PATH = fs.existsSync('C:/dev/.sigil/mcp-registry.toml')
  ? path.resolve('C:/dev/.sigil/mcp-registry.toml')
  : path.resolve('.sigil/mcp-registry.toml');

/**
 * Normalizes client name aliases into canonical client keys.
 */
export function normalizeClientName(clientName) {
  if (!clientName) return null;
  const c = String(clientName).trim().toLowerCase();
  if (['codex', 'codex-cli', 'codex_cli', 'codexcli'].includes(c)) return 'codex';
  if (['claude', 'claude-cli', 'claude_cli', 'claude-code', 'claude_code'].includes(c)) return 'claude';
  if (['desktop', 'claude-desktop', 'claude_desktop'].includes(c)) return 'desktop';
  if (['antigravity', 'antigravity-ide', 'antigravity_ide', 'agy'].includes(c)) return 'antigravity';
  if (['grok', 'grok-bridge', 'grok_bridge', 'grokbridge'].includes(c)) return 'grok';
  return null;
}

/**
 * Resolves canonical registry path from options or defaults.
 */
export function resolveRegistryPath(customPath) {
  if (customPath) {
    return path.resolve(customPath);
  }
  return DEFAULT_REGISTRY_PATH;
}

/**
 * Resolves destination path for client configurations.
 */
export function resolveClientPath(clientKey, options = {}) {
  const normKey = normalizeClientName(clientKey) || clientKey;

  // 1. Direct explicit options
  if (options[`${normKey}Path`]) {
    return path.resolve(options[`${normKey}Path`]);
  }
  if (options.configPath && (options.client === normKey || options.client === clientKey)) {
    return path.resolve(options.configPath);
  }

  // 2. Dest-dir option (used for test fixtures and staging)
  if (options.destDir) {
    const dir = path.resolve(options.destDir);
    switch (normKey) {
      case 'codex':
        return path.join(dir, 'codex', 'config.toml');
      case 'claude':
        return path.join(dir, 'claude', '.claude.json');
      case 'desktop':
        return path.join(dir, 'desktop', 'claude_desktop_config.json');
      case 'antigravity':
        return path.join(dir, 'antigravity', 'mcp_config.json');
      case 'grok':
        return path.join(dir, 'grok', 'config.json');
      default:
        return path.join(dir, `${normKey}-config.json`);
    }
  }

  // 3. Environment variable overrides
  const envVar = `MCP_${normKey.toUpperCase().replace(/[^A-Z0-9]/g, '_')}_CONFIG_PATH`;
  if (process.env[envVar]) {
    return path.resolve(process.env[envVar]);
  }
  if (process.env.MCP_GOVERNANCE_DEST_DIR) {
    return resolveClientPath(normKey, { ...options, destDir: process.env.MCP_GOVERNANCE_DEST_DIR });
  }

  // 4. Default user paths
  const home = os.homedir();
  switch (normKey) {
    case 'codex':
      return path.join(home, '.codex', 'config.toml');
    case 'claude':
      return path.join(home, '.claude.json');
    case 'desktop':
      if (process.platform === 'win32') {
        const appData = process.env.APPDATA || path.join(home, 'AppData', 'Roaming');
        return path.join(appData, 'Claude', 'claude_desktop_config.json');
      } else if (process.platform === 'darwin') {
        return path.join(home, 'Library', 'Application Support', 'Claude', 'claude_desktop_config.json');
      } else {
        return path.join(home, '.config', 'Claude', 'claude_desktop_config.json');
      }
    case 'antigravity':
      return path.join(home, '.gemini', 'antigravity', 'mcp_config.json');
    case 'grok':
      return path.resolve('C:/dev/sigil-repo/modules/grok-bridge/config.json');
    default:
      throw new Error(`Unknown client '${clientKey}'`);
  }
}

/**
 * Loads active profile settings from disk or defaults.
 */
export function loadSettings(options = {}, registryPath = DEFAULT_REGISTRY_PATH) {
  const settingsPath = options.settings
    ? path.resolve(options.settings)
    : path.join(path.dirname(registryPath), 'mcp-settings.json');

  const defaults = {
    activeProfiles: { ...DEFAULT_CLIENT_PROFILES }
  };

  if (fs.existsSync(settingsPath)) {
    try {
      const raw = fs.readFileSync(settingsPath, 'utf8');
      const parsed = JSON.parse(raw);
      return {
        activeProfiles: {
          ...defaults.activeProfiles,
          ...(parsed.activeProfiles || parsed.clients || {})
        },
        settingsPath
      };
    } catch {
      return { ...defaults, settingsPath };
    }
  }

  return { ...defaults, settingsPath };
}

/**
 * Renders the Profile Manifest dashboard table.
 */
export function renderStatusDashboard(options = {}) {
  const registryPath = resolveRegistryPath(options.registry || options.registryPath);
  let registry;
  try {
    registry = loadRegistry(registryPath);
  } catch (err) {
    return {
      allOk: false,
      exitCode: err.exitCode || EXIT_CODES.ERR_REGISTRY_SCHEMA_INVALID,
      error: err.message,
      rows: [],
      tableText: `[FAIL] Cannot load registry from ${registryPath}: ${err.message}`
    };
  }

  const budgetResult = validateBudgets(registry);
  const settings = loadSettings(options, registryPath);

  // If registry defines [clients], use them to enrich active profiles
  const activeProfileMap = {
    ...DEFAULT_CLIENT_PROFILES,
    ...(registry.clients || {}),
    ...(settings.activeProfiles || {})
  };

  const rows = [];
  let allOk = true;

  for (const [clientKey, meta] of Object.entries(CLIENT_METADATA)) {
    const activeProfileName = activeProfileMap[clientKey] || meta.defaultProfile;
    const profileDef = registry.profiles ? registry.profiles[activeProfileName] : null;

    if (!profileDef) {
      allOk = false;
      rows.push({
        clientKey,
        displayName: meta.displayName,
        activeProfile: activeProfileName,
        serverCount: 0,
        toolCount: 0,
        tokens: 0,
        maxBudgetTokens: 0,
        maxBudgetTools: 0,
        headroomTokens: 0,
        status: 'OVER_BUDGET',
        error: `Profile '${activeProfileName}' not found in registry`
      });
      continue;
    }

    const serverList = profileDef.servers || [];
    const serverCount = serverList.length;
    const toolCount = serverCount;
    const maxBudgetTools = profileDef.max_tools || 50;
    const maxBudgetTokens = profileDef.max_schema_tokens || 45000;

    let totalTokens = 0;
    for (const sName of serverList) {
      const sDef = registry.servers ? registry.servers[sName] : null;
      if (sDef) {
        totalTokens += sDef.schema_weight || 1000;
      }
    }

    const headroomTokens = maxBudgetTokens - totalTokens;
    const isProfileOk = (serverCount <= maxBudgetTools) && (totalTokens <= maxBudgetTokens);
    if (!isProfileOk) {
      allOk = false;
    }

    rows.push({
      clientKey,
      displayName: meta.displayName,
      activeProfile: activeProfileName,
      serverCount,
      toolCount,
      tokens: totalTokens,
      maxBudgetTokens,
      maxBudgetTools,
      headroomTokens,
      status: isProfileOk ? 'OK' : 'OVER_BUDGET'
    });
  }

  // Format table text
  const tableWidth = 120;
  const divider = '='.repeat(tableWidth);
  const thinDivider = '-'.repeat(tableWidth);
  const title = 'MCP Governance Profile Manifest';
  const paddedTitle = title.padStart((tableWidth + title.length) / 2).padEnd(tableWidth);

  const headerLine = [
    'Client'.padEnd(18),
    'Active Profile'.padEnd(18),
    'Servers'.padEnd(9),
    'Tools'.padEnd(7),
    'Tokens'.padEnd(11),
    'Max Budget (Tok/Tool)'.padEnd(25),
    'Headroom'.padEnd(13),
    'Status'.padEnd(12)
  ].join('');

  const rowLines = rows.map(r => {
    const formattedTokens = r.tokens.toLocaleString();
    const formattedMax = `${r.maxBudgetTokens.toLocaleString()} / ${r.maxBudgetTools}`;
    const formattedHeadroom = r.headroomTokens >= 0
      ? `+${r.headroomTokens.toLocaleString()}`
      : r.headroomTokens.toLocaleString();

    return [
      r.displayName.padEnd(18),
      r.activeProfile.padEnd(18),
      String(r.serverCount).padEnd(9),
      String(r.toolCount).padEnd(7),
      formattedTokens.padEnd(11),
      formattedMax.padEnd(25),
      formattedHeadroom.padEnd(13),
      r.status.padEnd(12)
    ].join('');
  });

  const okCount = rows.filter(r => r.status === 'OK').length;
  const overBudgetCount = rows.filter(r => r.status === 'OVER_BUDGET').length;

  const tableText = [
    divider,
    paddedTitle,
    divider,
    headerLine,
    thinDivider,
    ...rowLines,
    divider,
    `Summary: ${rows.length} clients configured | Status: ${okCount} OK, ${overBudgetCount} OVER_BUDGET`,
    `Registry: ${registryPath} (v${registry.registry_version || 'unknown'})`,
    divider
  ].join('\n');

  return {
    allOk,
    exitCode: allOk ? EXIT_CODES.SUCCESS : EXIT_CODES.ERR_BUDGET_VIOLATION,
    rows,
    tableText
  };
}

/**
 * CLI status subcommand.
 */
export async function statusCommand(options = {}) {
  const result = renderStatusDashboard(options);
  console.log(result.tableText);
  return {
    success: result.allOk,
    exitCode: result.exitCode
  };
}

/**
 * CLI validate subcommand.
 */
export async function validateCommand(options = {}) {
  const registryPath = resolveRegistryPath(options.registry);

  let registry;
  try {
    registry = loadRegistry(registryPath);
  } catch (err) {
    const code = err.exitCode || EXIT_CODES.ERR_REGISTRY_SCHEMA_INVALID;
    console.error(`[FAIL] Cannot load registry from ${registryPath}: ${err.message}`);
    return { success: false, exitCode: code, error: err.message };
  }

  const result = validateBudgets(registry);

  if (result.valid) {
    console.log(`[PASS] MCP Registry and Profile Budgets are valid: ${registryPath}`);
    console.log(`Registry Version: ${registry.registry_version || 'unknown'} (schema v${registry.schema_version || 1})`);
    console.log(`Profiles Validated: ${Object.keys(registry.profiles).length} | Errors: 0`);
    for (const [pName, stat] of Object.entries(result.profileStats)) {
      console.log(`  - ${pName}: ${stat.toolCount}/${stat.maxTools} tools, ${stat.totalTokens.toLocaleString()}/${stat.maxTokens.toLocaleString()} tokens (${stat.status})`);
    }
    return { success: true, exitCode: EXIT_CODES.SUCCESS, result };
  } else {
    const code = result.exitCode || EXIT_CODES.ERR_BUDGET_VIOLATION;
    console.error(`[FAIL] MCP Registry validation failed with ${result.errors.length} error(s) (exit code ${code}):`);
    for (const err of result.errors) {
      console.error(`  - ${err}`);
    }
    return { success: false, exitCode: code, errors: result.errors, result };
  }
}

/**
 * CLI sync subcommand.
 */
export async function syncCommand(options = {}) {
  const registryPath = resolveRegistryPath(options.registry);

  let registry;
  try {
    registry = loadRegistry(registryPath);
  } catch (err) {
    const code = err.exitCode || EXIT_CODES.ERR_REGISTRY_SCHEMA_INVALID;
    console.error(`[FAIL] Cannot load registry: ${err.message}`);
    return { success: false, exitCode: code };
  }

  // Validate budgets before writing (unless --force)
  const valResult = validateBudgets(registry);
  if (!valResult.valid && !options.force) {
    console.error(`[FAIL] Budget validation failed. Aborting sync (use --force to override):`);
    for (const err of valResult.errors) {
      console.error(`  - ${err}`);
    }
    return {
      success: false,
      exitCode: EXIT_CODES.ERR_BUDGET_VIOLATION,
      errors: valResult.errors
    };
  }

  // Determine target clients
  let clientKeys = Object.keys(CLIENT_METADATA);
  if (options.client) {
    const norm = normalizeClientName(options.client);
    if (!norm) {
      console.error(`[ERROR] Unknown client '${options.client}'. Supported clients: ${Object.keys(CLIENT_METADATA).join(', ')}`);
      return { success: false, exitCode: EXIT_CODES.ERR_CLIENT_CONFIG_INVALID };
    }
    clientKeys = [norm];
  }

  const settings = loadSettings(options, registryPath);
  const activeProfileMap = {
    ...DEFAULT_CLIENT_PROFILES,
    ...(registry.clients || {}),
    ...(settings.activeProfiles || {})
  };

  for (const clientKey of clientKeys) {
    const meta = CLIENT_METADATA[clientKey];
    const profileName = options.profile || activeProfileMap[clientKey] || meta.defaultProfile;
    const profileDef = registry.profiles ? registry.profiles[profileName] : null;

    if (!profileDef) {
      console.error(`[ERROR] Profile '${profileName}' not found in registry for client '${clientKey}'`);
      return { success: false, exitCode: EXIT_CODES.ERR_REGISTRY_SCHEMA_INVALID };
    }

    // Check budget for this profile specifically if --force not passed
    const stat = valResult.profileStats[profileName];
    if (stat && stat.status === 'OVER_BUDGET' && !options.force) {
      console.error(`[FAIL] Profile '${profileName}' exceeds budget limit. Aborting sync for ${meta.displayName}. Use --force to override.`);
      return { success: false, exitCode: EXIT_CODES.ERR_BUDGET_VIOLATION };
    }

    // Build active servers map
    const activeServers = {};
    for (const sName of profileDef.servers || []) {
      if (registry.servers && registry.servers[sName]) {
        activeServers[sName] = registry.servers[sName];
      }
    }

    const targetPath = resolveClientPath(clientKey, options);
    let existingContent = '';
    if (fs.existsSync(targetPath)) {
      try {
        existingContent = fs.readFileSync(targetPath, 'utf8');
      } catch (err) {
        console.error(`[ERROR] Failed to read existing file at ${targetPath}: ${err.message}`);
        return { success: false, exitCode: EXIT_CODES.ERR_CLIENT_CONFIG_INVALID };
      }
    }

    let compiledContent;
    try {
      switch (clientKey) {
        case 'codex':
          compiledContent = compileCodexToml(existingContent, activeServers);
          break;
        case 'claude':
          compiledContent = compileClaudeJson(existingContent, activeServers);
          break;
        case 'desktop':
          compiledContent = compileDesktopJson(existingContent, activeServers);
          break;
        case 'antigravity':
          compiledContent = compileClaudeJson(existingContent, activeServers);
          break;
        case 'grok':
          compiledContent = compileGrokBridge(existingContent, activeServers);
          break;
        default:
          compiledContent = compileClaudeJson(existingContent, activeServers);
          break;
      }
    } catch (err) {
      console.error(`[ERROR] AST compilation failed for ${meta.displayName}: ${err.message}`);
      return { success: false, exitCode: err.exitCode || EXIT_CODES.ERR_AST_PARSE_FAILURE };
    }

    if (options.dryRun) {
      console.log(`[DRY-RUN] Client: ${meta.displayName} (${clientKey})`);
      console.log(`  Target Path: ${targetPath}`);
      console.log(`  Active Profile: ${profileName} (${Object.keys(activeServers).length} servers)`);
      console.log(`--- Compiled Output Preview ---`);
      console.log(compiledContent.trimEnd());
      console.log(`-------------------------------\n`);
    } else {
      try {
        const writeRes = atomicWriteWithBackup(targetPath, compiledContent);
        console.log(`[SYNCED] ${meta.displayName} -> ${targetPath} (Profile: ${profileName})`);
        if (writeRes.backupPath) {
          console.log(`  Backup created: ${writeRes.backupPath}`);
        }
      } catch (err) {
        console.error(`[ERROR] Atomic write failed for ${targetPath}: ${err.message}`);
        return { success: false, exitCode: err.exitCode || EXIT_CODES.ERR_ATOMIC_WRITE_FAILURE };
      }
    }
  }

  return { success: true, exitCode: EXIT_CODES.SUCCESS };
}

/**
 * CLI profile set subcommand.
 */
export async function setProfileCommand(clientInput, profileInput, options = {}) {
  const clientKey = normalizeClientName(clientInput);
  if (!clientKey) {
    console.error(`[ERROR] Unknown client '${clientInput}'. Supported clients: ${Object.keys(CLIENT_METADATA).join(', ')}`);
    return { success: false, exitCode: EXIT_CODES.ERR_CLIENT_CONFIG_INVALID };
  }

  const registryPath = resolveRegistryPath(options.registry);
  let registry;
  try {
    registry = loadRegistry(registryPath);
  } catch (err) {
    console.error(`[ERROR] Cannot load registry: ${err.message}`);
    return { success: false, exitCode: err.exitCode || EXIT_CODES.ERR_REGISTRY_SCHEMA_INVALID };
  }

  if (!registry.profiles || !registry.profiles[profileInput]) {
    console.error(`[ERROR] Profile '${profileInput}' does not exist in registry. Available profiles: ${Object.keys(registry.profiles || {}).join(', ')}`);
    return { success: false, exitCode: EXIT_CODES.ERR_REGISTRY_SCHEMA_INVALID };
  }

  const settings = loadSettings(options, registryPath);
  settings.activeProfiles[clientKey] = profileInput;

  const settingsPath = settings.settingsPath;
  try {
    atomicWriteWithBackup(settingsPath, JSON.stringify({ activeProfiles: settings.activeProfiles }, null, 2) + '\n');
    console.log(`[OK] Updated active profile for '${CLIENT_METADATA[clientKey].displayName}' (${clientKey}) to '${profileInput}'.`);
    return { success: true, exitCode: EXIT_CODES.SUCCESS, settings };
  } catch (err) {
    console.error(`[ERROR] Failed to save settings: ${err.message}`);
    return { success: false, exitCode: err.exitCode || EXIT_CODES.ERR_ATOMIC_WRITE_FAILURE };
  }
}

/**
 * CLI profile get subcommand.
 */
export async function getProfileCommand(clientInput, options = {}) {
  const clientKey = normalizeClientName(clientInput);
  if (!clientKey) {
    console.error(`[ERROR] Unknown client '${clientInput}'. Supported clients: ${Object.keys(CLIENT_METADATA).join(', ')}`);
    return { success: false, exitCode: EXIT_CODES.ERR_CLIENT_CONFIG_INVALID };
  }

  const registryPath = resolveRegistryPath(options.registry);
  const settings = loadSettings(options, registryPath);
  const activeProfile = settings.activeProfiles[clientKey] || CLIENT_METADATA[clientKey].defaultProfile;
  console.log(`${clientKey}: ${activeProfile}`);
  return { success: true, exitCode: EXIT_CODES.SUCCESS, profile: activeProfile };
}

/**
 * CLI profile list subcommand.
 */
export async function listProfilesCommand(options = {}) {
  const registryPath = resolveRegistryPath(options.registry);
  const settings = loadSettings(options, registryPath);
  console.log('Active Client MCP Profiles:');
  for (const [key, meta] of Object.entries(CLIENT_METADATA)) {
    const p = settings.activeProfiles[key] || meta.defaultProfile;
    console.log(`  ${meta.displayName.padEnd(16)} (${key}): ${p}`);
  }
  return { success: true, exitCode: EXIT_CODES.SUCCESS };
}

/**
 * Parses raw command-line arguments.
 */
export function parseArgs(rawArgs) {
  const parsed = {
    command: null,
    subcommand: null,
    subcommandArgs: [],
    flags: {}
  };

  const args = [...rawArgs];
  let i = 0;

  while (i < args.length) {
    const arg = args[i];

    if (arg.startsWith('--')) {
      const eqIdx = arg.indexOf('=');
      let key;
      let val;

      if (eqIdx !== -1) {
        key = arg.slice(2, eqIdx);
        val = arg.slice(eqIdx + 1);
      } else {
        key = arg.slice(2);
        if (i + 1 < args.length && !args[i + 1].startsWith('-')) {
          val = args[i + 1];
          i++;
        } else {
          val = true;
        }
      }

      parsed.flags[key] = val;
      // Also register camelCase
      const camel = key.replace(/-([a-z])/g, (_, ch) => ch.toUpperCase());
      parsed.flags[camel] = val;
    } else if (arg.startsWith('-')) {
      const key = arg.slice(1);
      parsed.flags[key] = true;
    } else {
      if (!parsed.command) {
        parsed.command = arg;
      } else if (parsed.command === 'profile' && !parsed.subcommand) {
        parsed.subcommand = arg;
      } else {
        parsed.subcommandArgs.push(arg);
      }
    }
    i++;
  }

  return parsed;
}

/**
 * Prints CLI usage instructions.
 */
export function printUsage() {
  console.log(`
MCP Governance Unified CLI Controller

Usage:
  node cli.mjs <command> [subcommand] [options]

Commands:
  status                                 Display profile manifest table across all clients
  validate [--registry <path>]           Validate registry and profile token budgets
  sync [options]                         Compile and sync MCP configurations across clients
  profile set <client> <profile>         Set the active profile for a given client
  profile get <client>                   Get the active profile for a given client
  profile list                           List active profiles for all clients
  help, --help                           Show this usage information

Sync Options:
  --dry-run                              Preview generated configurations without writing
  --client=<name>                        Sync only a specific client (codex, claude, desktop, antigravity, grok)
  --profile=<name>                       Override active profile for this sync
  --registry=<path>                      Path to mcp-registry.toml
  --dest-dir=<path>                      Destination root directory (useful for tests/staging)
  --force                                Force sync even if budget validation fails

Exit Codes:
  0   Success
  10  Budget Violation (max_tools or max_schema_tokens exceeded)
  20  AST/CST Parse Failure
  30  Atomic Write Failure
  40  Client Config Invalid
  50  Registry Schema Invalid
`);
}

/**
 * CLI Main Entrypoint.
 */
export async function runCli(argv = process.argv.slice(2)) {
  const parsed = parseArgs(argv);
  const cmd = parsed.command;

  if (!cmd || cmd === 'help' || parsed.flags.help || parsed.flags.h) {
    printUsage();
    return EXIT_CODES.SUCCESS;
  }

  switch (cmd) {
    case 'status':
    case 'status-dashboard': {
      const res = await statusCommand(parsed.flags);
      return res.exitCode;
    }

    case 'validate': {
      const res = await validateCommand(parsed.flags);
      return res.exitCode;
    }

    case 'sync': {
      const res = await syncCommand(parsed.flags);
      return res.exitCode;
    }

    case 'profile': {
      const sub = parsed.subcommand;
      const subArgs = parsed.subcommandArgs;

      if (sub === 'set') {
        const client = subArgs[0];
        const profile = subArgs[1];
        if (!client || !profile) {
          console.error('[ERROR] Usage: node cli.mjs profile set <client> <profile>');
          return EXIT_CODES.ERR_CLIENT_CONFIG_INVALID;
        }
        const res = await setProfileCommand(client, profile, parsed.flags);
        return res.exitCode;
      }

      if (sub === 'get') {
        const client = subArgs[0];
        if (!client) {
          console.error('[ERROR] Usage: node cli.mjs profile get <client>');
          return EXIT_CODES.ERR_CLIENT_CONFIG_INVALID;
        }
        const res = await getProfileCommand(client, parsed.flags);
        return res.exitCode;
      }

      if (sub === 'list' || !sub) {
        const res = await listProfilesCommand(parsed.flags);
        return res.exitCode;
      }

      console.error(`[ERROR] Unknown profile subcommand '${sub}'. Use 'set', 'get', or 'list'.`);
      return EXIT_CODES.ERR_CLIENT_CONFIG_INVALID;
    }

    default:
      console.error(`[ERROR] Unknown command '${cmd}'. Run 'node cli.mjs --help' for usage.`);
      return EXIT_CODES.ERR_CLIENT_CONFIG_INVALID;
  }
}

// Direct invocation check
const isMain = process.argv[1] && (
  process.argv[1] === fileURLToPath(import.meta.url) ||
  process.argv[1].endsWith('cli.mjs')
);

if (isMain) {
  runCli().then(code => {
    process.exit(code !== undefined ? code : 0);
  }).catch(err => {
    console.error(`[FATAL] ${err.message}`);
    process.exit(err.exitCode || 1);
  });
}
