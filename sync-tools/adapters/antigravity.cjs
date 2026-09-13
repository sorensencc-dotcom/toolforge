const path = require('node:path');
const { BaseAgentAdapter } = require('../lib/base-adapter.cjs');

class AntigravityAdapter extends BaseAgentAdapter {
  constructor() {
    super('antigravity');
  }

  targets(workspace) {
    return [
      'GEMINI.md',
      'AGENTS.md',
      'STATUS.md'
    ].map(x => path.join(workspace, x));
  }
}

module.exports = AntigravityAdapter;
