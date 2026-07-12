import { execute } from '../src/index';

describe('tool-lifecycle-manager', () => {
  describe('output contract', () => {
    it('resolves with status "ok" for the current stub behavior', async () => {
      const result = await execute({});
      expect(result.status).toBe('ok');
    });

    it('resolves with the documented stub message', async () => {
      const result = await execute({});
      expect(result.message).toBe('Skill stub executed');
    });

    it('returns exactly the two documented result fields', async () => {
      const result = await execute({});
      expect(Object.keys(result).sort()).toEqual(['message', 'status']);
    });

    it('returns a Promise (async contract)', () => {
      const result = execute({});
      expect(result).toBeInstanceOf(Promise);
    });
  });

  describe('input handling', () => {
    it('accepts an undefined input without throwing', async () => {
      await expect(execute(undefined)).resolves.toEqual({
        status: 'ok',
        message: 'Skill stub executed',
      });
    });

    it('accepts a null input without throwing', async () => {
      await expect(execute(null)).resolves.toEqual({
        status: 'ok',
        message: 'Skill stub executed',
      });
    });

    it('accepts an empty object input', async () => {
      await expect(execute({})).resolves.toEqual({
        status: 'ok',
        message: 'Skill stub executed',
      });
    });

    it('accepts a lifecycle-shaped registration payload without throwing', async () => {
      const payload = { action: 'register', toolId: 'rollback-phase', version: '1.0.0' };
      await expect(execute(payload)).resolves.toEqual({
        status: 'ok',
        message: 'Skill stub executed',
      });
    });

    it('accepts an array input without throwing', async () => {
      await expect(execute([1, 2, 3])).resolves.toEqual({
        status: 'ok',
        message: 'Skill stub executed',
      });
    });
  });

  describe('logging behavior', () => {
    let logSpy: jest.SpyInstance;

    beforeEach(() => {
      logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    });

    afterEach(() => {
      logSpy.mockRestore();
    });

    it('logs the skill name on invocation', async () => {
      await execute({});
      expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('tool-lifecycle-manager'));
    });

    it('logs exactly once per invocation', async () => {
      await execute({});
      expect(logSpy).toHaveBeenCalledTimes(1);
    });
  });

  describe('isolation and concurrency', () => {
    it('resolves each call in a concurrent batch independently with the stub payload', async () => {
      const inputs = [{ action: 'register' }, { action: 'deprecate' }, { action: 'distribute' }];
      const results = await Promise.all(inputs.map(execute));
      results.forEach(result => {
        expect(result).toEqual({ status: 'ok', message: 'Skill stub executed' });
      });
    });
  });
});
