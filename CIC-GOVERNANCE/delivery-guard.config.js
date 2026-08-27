export default {
  repository: {
    id: 'cic-governance',
    root: '.',
  },
  generatedPaths: ['.ijfw/**', 'wiki/**'],
  automationPaths: [
    '.github/workflows/**',
    'scripts/**',
    'CIC-GOVERNANCE/scripts/**',
    'CIC-GOVERNANCE/packages/delivery-guard/src/**',
    'CIC-GOVERNANCE/delivery-guard.config.js',
  ],
  testCommands: [
    'npm --prefix CIC-GOVERNANCE --workspace @cic/delivery-guard test',
  ],
  hookInstaller: {
    command: 'node CIC-GOVERNANCE/scripts/setup-git-hook.mjs',
    installedPath: '.git/hooks/pre-commit',
  },
};
