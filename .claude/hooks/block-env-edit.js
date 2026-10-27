let data = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', (c) => (data += c));
process.stdin.on('end', () => {
  let input = {};
  try {
    input = JSON.parse(data || '{}');
  } catch {
    input = {};
  }
  const toolInput = input.tool_input || input.toolInput || input.tool?.input || {};
  const filePath = toolInput.file_path || toolInput.filePath || toolInput.path || process.argv[2] || '';
  const base = String(filePath).split(/[\\/]/).pop() || '';
  const allowed = new Set(['.env.example', '.env.sample']);
  const isEnv = base === '.env' || (base.startsWith('.env.') && !allowed.has(base));

  if (isEnv) {
    console.log(
      JSON.stringify({
        hookSpecificOutput: {
          hookEventName: 'PreToolUse',
          permissionDecision: 'deny',
          permissionDecisionReason:
            'Blocked: direct edits to .env files are disallowed. Use .env.example for templates.',
        },
      })
    );
  } else {
    console.log('{}');
  }
});
