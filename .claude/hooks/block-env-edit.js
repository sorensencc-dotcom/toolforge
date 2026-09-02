let data = '';
process.stdin.on('data', (c) => (data += c));
process.stdin.on('end', () => {
  const input = JSON.parse(data || '{}');
  const filePath = (input.tool_input && input.tool_input.file_path) || '';
  const base = filePath.split(/[\\/]/).pop() || '';
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
