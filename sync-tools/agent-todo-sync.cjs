/**
 * sync-tools/agent-todo-sync.cjs
 * 
 * Multi-Agent TODO / Task Synchronization Engine.
 * Scans, aggregates, deduplicates, and synchronizes task lists across
 * heterogeneous agent context files (MEMORY.md, AGENTS.md, GEMINI.md, grok-context.md, TODOS.md).
 * 
 * Uses managed-region markers (<!-- MANAGED-REGION: AGENT-TODOS -->) to ensure
 * clean, non-duplicating, idempotent updates across workspace context files.
 */

const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const os = require('node:os');
const { encodeWorkspaceKey } = require('./adapters/claude-code.cjs');
const { atomicWrite } = require('./lib/safe-write.cjs');

function stripBOM(str) {
  if (typeof str !== 'string') return '';
  return str.charCodeAt(0) === 0xfeff ? str.slice(1) : str;
}

function detectLineEnding(str) {
  return str && str.includes('\r\n') ? '\r\n' : '\n';
}

// Checkbox extraction pattern
const TODO_ITEM_REGEX = /^\s*-\s*\[([ xX/])\]\s+(.+)$/gm;
const MANAGED_REGION_START = '<!-- MANAGED-REGION: AGENT-TODOS -->';
const MANAGED_REGION_END = '<!-- /MANAGED-REGION: AGENT-TODOS -->';

/**
 * Normalizes task text for deduplication hashing
 */
function normalizeTaskText(text) {
  return text
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .replace(/\[p[0-3]\]/i, '')
    .trim();
}

/**
 * Generates a stable task hash
 */
function getTaskHash(text) {
  const normalized = normalizeTaskText(text);
  return crypto.createHash('sha256').update(normalized).digest('hex').substring(0, 12);
}

/**
 * Parses markdown content for TODO items (excluding existing managed region)
 */
function parseTodoItems(content, sourcePath = '') {
  const clean = stripBOM(content || '');
  
  // Remove existing managed region before parsing to avoid self-reinforcing loops
  const regionRegex = new RegExp(`${MANAGED_REGION_START}[\\s\\S]*?${MANAGED_REGION_END}`, 'g');
  const userContent = clean.replace(regionRegex, '');

  const items = [];
  let match;
  TODO_ITEM_REGEX.lastIndex = 0;
  
  while ((match = TODO_ITEM_REGEX.exec(userContent)) !== null) {
    const checkChar = match[1].trim();
    const rawText = match[2].trim();
    const completed = checkChar.toLowerCase() === 'x';
    const inProgress = checkChar === '/';
    
    // Extract priority if present (P0, P1, P2, P3)
    const priorityMatch = rawText.match(/\[(P[0-3])\]/i);
    const priority = priorityMatch ? priorityMatch[1].toUpperCase() : 'P2';
    
    const hash = getTaskHash(rawText);
    items.push({
      hash,
      rawText,
      completed,
      inProgress,
      priority,
      sourcePath
    });
  }
  return items;
}

/**
 * Merges task lists into a canonical state matrix
 */
function mergeTaskLists(allTaskListCollections) {
  const taskMap = new Map();

  for (const list of allTaskListCollections) {
    for (const item of list) {
      if (!taskMap.has(item.hash)) {
        taskMap.set(item.hash, { ...item });
      } else {
        const existing = taskMap.get(item.hash);
        // Completed takes precedence if any harness marked it completed
        if (item.completed) {
          existing.completed = true;
          existing.inProgress = false;
        } else if (item.inProgress && !existing.completed) {
          existing.inProgress = true;
        }
        // Retain highest priority (P0 > P1 > P2 > P3)
        if (item.priority < existing.priority) {
          existing.priority = item.priority;
        }
      }
    }
  }

  // Convert map to sorted array (P0 first, then P1, P2, P3, completed at end)
  const priorityOrder = { P0: 0, P1: 1, P2: 2, P3: 3 };
  return Array.from(taskMap.values()).sort((a, b) => {
    if (a.completed !== b.completed) return a.completed ? 1 : -1;
    const pA = priorityOrder[a.priority] ?? 2;
    const pB = priorityOrder[b.priority] ?? 2;
    if (pA !== pB) return pA - pB;
    return a.rawText.localeCompare(b.rawText);
  });
}

/**
 * Renders the formatted Markdown block for the managed region
 */
function renderTodoBlock(canonicalTasks, eol = '\n') {
  const lines = [
    MANAGED_REGION_START,
    '### Active Multi-Agent Tasks',
    '| Status | Priority | Task Description |',
    '| :---: | :---: | :--- |'
  ];

  if (canonicalTasks.length === 0) {
    lines.push('| - | - | *No active tasks pending across harnesses.* |');
  } else {
    for (const task of canonicalTasks) {
      const statusSymbol = task.completed ? '✅ `[x]`' : (task.inProgress ? '🔄 `[/]`' : '⏳ `[ ]`');
      lines.push(`| ${statusSymbol} | **${task.priority}** | ${task.rawText} |`);
    }
  }

  lines.push(MANAGED_REGION_END);
  return lines.join(eol);
}

/**
 * Replaces or injects the managed region into target content
 */
function injectManagedRegion(content, newRegionBlock) {
  const clean = stripBOM(content || '');
  const eol = detectLineEnding(clean);
  const regionRegex = new RegExp(`${MANAGED_REGION_START}[\\s\\S]*?${MANAGED_REGION_END}`, 'g');

  let nextContent = '';
  if (regionRegex.test(clean)) {
    nextContent = clean.replace(regionRegex, newRegionBlock);
  } else if (clean.trim().length === 0) {
    nextContent = newRegionBlock + eol;
  } else {
    nextContent = clean.trimEnd() + eol + eol + newRegionBlock + eol;
  }

  if (!nextContent.endsWith(eol)) {
    nextContent += eol;
  }

  return nextContent;
}

/**
 * Main Sync Orchestrator
 */
async function syncWorkspaceTodos(options = {}) {
  const rootDir = path.resolve(options.workspacePath || process.cwd());
  const isDryRun = !!options.dryRun;

  const claudeMemoryFile = path.join(
    os.homedir(),
    '.claude',
    'projects',
    encodeWorkspaceKey(rootDir),
    'memory',
    'MEMORY.md'
  );

  const targetFiles = [
    path.join(rootDir, 'TODOS.md'),
    path.join(rootDir, 'AGENTS.md'),
    path.join(rootDir, 'GEMINI.md'),
    path.join(rootDir, '.sigil', 'grok-context.md'),
    path.join(rootDir, '.local-agent-context.md'),
    claudeMemoryFile
  ];

  const collections = [];
  const validTargets = [];

  for (const filePath of targetFiles) {
    if (fs.existsSync(filePath)) {
      validTargets.push(filePath);
      const content = fs.readFileSync(filePath, 'utf8');
      const items = parseTodoItems(content, filePath);
      collections.push(items);
    }
  }

  const canonicalTasks = mergeTaskLists(collections);
  const receipts = [];

  for (const filePath of validTargets) {
    const originalContent = fs.readFileSync(filePath, 'utf8');
    const eol = detectLineEnding(originalContent);
    const formattedBlock = renderTodoBlock(canonicalTasks, eol);
    const updatedContent = injectManagedRegion(originalContent, formattedBlock);
    const changed = originalContent !== updatedContent;

    if (changed && !isDryRun) {
      await atomicWrite(filePath, updatedContent);
    }

    receipts.push({
      targetFile: filePath,
      status: changed ? (isDryRun ? 'WOULD_MODIFY' : 'UPDATED') : 'UNCHANGED',
      changesMade: changed
    });
  }

  // Sort receipts by path ascending
  receipts.sort((a, b) => a.targetFile.localeCompare(b.targetFile));

  return {
    workspace: rootDir,
    totalUniqueTasks: canonicalTasks.length,
    canonicalTasks,
    receipts
  };
}

// CLI Execution
if (require.main === module) {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  const workspaceIdx = args.indexOf('--workspace-path');
  const workspacePath = workspaceIdx !== -1 ? args[workspaceIdx + 1] : process.cwd();

  syncWorkspaceTodos({ dryRun, workspacePath })
    .then(result => console.log(JSON.stringify(result, null, 2)))
    .catch(err => {
      console.error(err);
      process.exit(1);
    });
}

module.exports = {
  normalizeTaskText,
  getTaskHash,
  parseTodoItems,
  mergeTaskLists,
  renderTodoBlock,
  injectManagedRegion,
  syncWorkspaceTodos
};
