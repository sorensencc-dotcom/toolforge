/**
 * PreToolUse halt for shell commands that upload binaries to public hosts.
 * Stdin mode speaks the Claude hook protocol (deny JSON, exit 0).
 * Argv mode exits 1 so a direct invocation stops the command.
 */
import { evaluateShellCommand } from '../../scripts/egress-upload-gate.mjs';

function emit(result, haltProcess) {
  if (!result || result.decision !== 'deny') {
    process.stdout.write('{}\n');
    process.exit(0);
  }
  const payload = {
    hookSpecificOutput: {
      hookEventName: 'PreToolUse',
      permissionDecision: 'deny',
      permissionDecisionReason: result.reason,
    },
  };
  process.stdout.write(`${JSON.stringify(payload)}\n`);
  process.stderr.write(`[egress] ${result.reason}\n`);
  process.exit(haltProcess ? 1 : 0);
}

const argvCommand = process.argv.slice(2).join(' ').trim();
if (argvCommand) {
  emit(evaluateShellCommand(argvCommand), true);
}

let data = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', (chunk) => {
  data += chunk;
});
process.stdin.on('end', () => {
  let command = '';
  try {
    const input = JSON.parse(data || '{}');
    command = input.tool_input?.command || input.tool?.input?.command || '';
  } catch {
    command = '';
  }
  const result = command ? evaluateShellCommand(command) : { decision: 'allow' };
  emit(result, false);
});
