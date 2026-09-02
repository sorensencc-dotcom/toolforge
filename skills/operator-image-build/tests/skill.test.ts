import { main } from '../src/index';

describe('operator-image-build', () => {
  it('should handle dry-run mode', async () => {
    const result = await main({ dryRun: true });
    expect(result.status).toBeDefined();
    expect(result.images).toBeDefined();
  });

  it('should return status field', async () => {
    const result = await main({ dryRun: true });
    expect(result.status).toBeDefined();
    expect(typeof result.status).toBe('string');
  });

  it('should return images array', async () => {
    const result = await main({ dryRun: true });
    expect(Array.isArray(result.images)).toBe(true);
  });

  it('should handle no parameters', async () => {
    const result = await main({});
    expect(result.status).toBeDefined();
  });

  it('should return object with required fields', async () => {
    const result = await main({});
    expect(result).toHaveProperty('status');
    expect(result).toHaveProperty('images');
  });
});
