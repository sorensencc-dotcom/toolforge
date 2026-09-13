const path = require('node:path');
const { BaseAgentAdapter } = require('../lib/base-adapter.cjs');

class CodexAdapter extends BaseAgentAdapter {
  constructor() {
    super('codex');
  }

  targets(workspace) {
    return [
      'codex/AGENTS.md',
      'CODEX.md',
      '.ijfw/memory/handoff.md',
      '.ijfw/memory/project-journal.md'
    ].map(x => path.join(workspace, x));
  }
}

module.exports = CodexAdapter;
