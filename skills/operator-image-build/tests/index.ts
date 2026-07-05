import { main } from '../src/index';

describe('operator-image-build', () => {
  it('should handle dry-run mode without executing', async () => {
    const result = await main({
      action: 'all',
      registry: 'registry.test:5000',
      workdir: '/tmp/test',
      dryRun: true,
      verbose: false,
    });

    expect(result.status).toBe('ok');
    expect(result.data.action).toBe('all');
  });

  it('should fail gracefully with missing workdir', async () => {
    const result = await main({
      action: 'build',
      registry: 'registry.test:5000',
      workdir: '/nonexistent/path',
      dryRun: false,
      verbose: false,
    });

    expect(result.status).toBe('error');
  });

  it('should accept all action types', async () => {
    const actions = ['build', 'tag', 'push', 'verify', 'import', 'all'];

    for (const action of actions) {
      const result = await main({
        action,
        dryRun: true,
        verbose: false,
      });

      expect(result.status).toBe('ok');
      expect(result.data.action).toBe(action);
    }
  });

  it('should include duration in response', async () => {
    const result = await main({
      action: 'verify',
      dryRun: true,
      verbose: false,
    });

    expect(result.data.duration_ms).toBeGreaterThan(0);
  });
});
