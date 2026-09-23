#!/usr/bin/env node

/**
 * PreToolUse Bash & PowerShell Interceptor
 * Blocks coding agents from running broad, brute-force grep searches across the repo
 * when deterministic AST tools (Graft) and SQLite context caches are available.
 */

// Hoist regex patterns outside invocation scope
const GREP_PATTERNS = [
  /\bgrep\s+-[rnEFiIw]*/i,
  /\brg\s+/i,
  /\bag\s+/i,
  /\bfindstr\s+/i,
  /\bgit\s+grep\b/i
];

const PIPED_PATTERN = /\|(?:\s*xargs\s+)?(?:grep|rg|ag|findstr)\b/i;
const SINGLE_FILE_PATTERN = /\.(?:json|log|csv|txt|lock|md|ts|js|py|html|css|yaml|yml|toml)\b/i;

function evaluateSingleSegment(segment) {
  const trimmed = segment.trim();
  if (!trimmed) {
    return false;
  }

  // 1. Allow pipeline commands
  if (PIPED_PATTERN.test(trimmed)) {
    return false;
  }

  // Detect broad keyword search utilities
  const matchesGrep = GREP_PATTERNS.some((pattern) => pattern.test(trimmed));
  if (!matchesGrep) {
    return false;
  }

  // 2. Allow explicit single-file searches (has target file extension and does not search root/dir)
  const isSingleFileSearch = SINGLE_FILE_PATTERN.test(trimmed) && !/\s+\.\s*$/.test(trimmed);
  if (isSingleFileSearch) {
    return false;
  }

  return true;
}

function evaluateCommand(rawCommand) {
  if (!rawCommand || typeof rawCommand !== 'string') {
    process.exit(0);
  }

  // Split chained statements (&&, ;, ||) so each segment is evaluated independently
  const segments = rawCommand.split(/&&|\|\||;/);
  const shouldBlock = segments.some(evaluateSingleSegment);

  if (shouldBlock) {
    console.error('\n[TOOL REDIRECT: DETERMINISTIC CODE GRAPH]');
    console.error('Workspace-wide grep is disabled because deterministic AST indexing is active.');
    console.error('Use one of these alternatives:');
    console.error('  - Callers / blast radius : graft callers <symbol>  OR mcp__graft__graft_trace_calls');
    console.error('  - File surface & API     : graft skeleton <file>   OR mcp__graft__graft_file_api');
    console.error('  - Ranked code search     : graft ask \"<query>\"     OR mcp__graft__graft_find_code');
    console.error('  - Coupling & hotspots    : graft map               OR mcp__graft__graft_repo_map\n');

    process.exit(1);
  }

  process.exit(0);
}

// Read from process arguments if passed directly, or parse stdin JSON payload from Claude Code
if (process.argv[2]) {
  evaluateCommand(process.argv.slice(2).join(' '));
} else {
  let inputBuffer = '';
  process.stdin.setEncoding('utf-8');
  process.stdin.on('data', (chunk) => {
    inputBuffer += chunk;
  });
  process.stdin.on('end', () => {
    try {
      if (!inputBuffer.trim()) {
        process.exit(0);
      }
      const hookData = JSON.parse(inputBuffer);
      const command =
        hookData.tool?.input?.command ||
        hookData.tool?.input?.query ||
        hookData.tool_input?.command ||
        '';
      evaluateCommand(command);
    } catch {
      process.exit(0);
    }
  });
}
