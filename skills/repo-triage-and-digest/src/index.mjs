import * as readline from 'node:readline';
import { handleMcpMessage, triageAndDigest } from './pipeline.mjs';

function argument(name) {
  const index = process.argv.indexOf(name);
  return index === -1 ? undefined : process.argv[index + 1];
}

export function startMcpStdio(input = process.stdin, output = process.stdout) {
  const lines = readline.createInterface({ input, crlfDelay: Infinity });
  lines.on('line', (line) => {
    if (!line.trim()) return;
    let message;
    try {
      message = JSON.parse(line);
    } catch {
      output.write(`${JSON.stringify({ jsonrpc: '2.0', id: null, error: { code: -32700, message: 'Invalid JSON' } })}\n`);
      return;
    }
    const response = handleMcpMessage(message);
    if (response) output.write(`${JSON.stringify(response)}\n`);
  });
  return lines;
}

if (process.argv[1] && process.argv[1].endsWith('index.mjs')) {
  if (process.argv.includes('--mcp')) {
    startMcpStdio();
  } else {
    const repositoryUrl = argument('--url');
    if (!repositoryUrl) {
      console.error('Usage: node skills/repo-triage-and-digest/src/index.mjs --url <github-url> [--local <dir>] [--include <globs>]');
      process.exit(1);
    }
    const result = triageAndDigest({
      repositoryUrl,
      localRoot: argument('--local'),
      includePatterns: argument('--include'),
      excludePatterns: argument('--exclude'),
      maxFileSizeKb: argument('--max-kb') ? Number(argument('--max-kb')) : undefined,
      targetModules: argument('--modules')?.split(',')
    });
    console.log(JSON.stringify(result, null, 2));
  }
}
