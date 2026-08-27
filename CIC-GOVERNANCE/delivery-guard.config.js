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
    'CIC-GOVERNANCE/packages/delivery-guard/scripts/evaluate-automation-policy.mjs',
    'CIC-GOVERNANCE/delivery-guard.config.js',
    'setup-git-hooks.ps1',
    'ci-pipeline.ps1',
  ],
  testCommands: [
    'npm --prefix CIC-GOVERNANCE --workspace @cic/delivery-guard test',
  ],
  trustedExemptionAuthorities: ['tier-1'],
  hookInstaller: {
    command: 'node CIC-GOVERNANCE/scripts/setup-git-hook.mjs',
    installedPath: '.git/hooks/pre-commit',
  },
};
