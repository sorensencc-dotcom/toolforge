import main, { main as namedMain } from '../src/index';

describe('rollback-phase', () => {
  describe('output contract', () => {
    it('resolves with the requested phaseId echoed back', async () => {
      const result = await main({ phaseId: 'phase-5' });
      expect(result.phaseId).toBe('phase-5');
    });

    it('reports rollbackStatus as "pending" for the current stub behavior', async () => {
      const result = await main({ phaseId: 'phase-5' });
      expect(result.rollbackStatus).toBe('pending');
    });

    it('reports restored as false for the current stub behavior', async () => {
      const result = await main({ phaseId: 'phase-5' });
      expect(result.restored).toBe(false);
    });

    it('returns exactly the three documented result fields', async () => {
      const result = await main({ phaseId: 'phase-5' });
      expect(Object.keys(result).sort()).toEqual(['phaseId', 'restored', 'rollbackStatus']);
    });

    it('returns a Promise (async contract)', () => {
      const result = main({ phaseId: 'phase-5' });
      expect(result).toBeInstanceOf(Promise);
    });
  });

  describe('input handling', () => {
    it('accepts a request without targetState (optional field)', async () => {
      const result = await main({ phaseId: 'phase-5' });
      expect(result.phaseId).toBe('phase-5');
    });

    it('accepts a request with targetState provided', async () => {
      const result = await main({ phaseId: 'phase-5', targetState: 'checkpoint-4' });
      expect(result.phaseId).toBe('phase-5');
    });

    it('does not leak targetState into the result payload', async () => {
      const result = await main({ phaseId: 'phase-5', targetState: 'checkpoint-4' });
      expect(result).not.toHaveProperty('targetState');
    });

    it('does not mutate the input object', async () => {
      const input = { phaseId: 'phase-5', targetState: 'checkpoint-4' };
      const snapshot = { ...input };
      await main(input);
      expect(input).toEqual(snapshot);
    });

    it('handles an empty-string phaseId without throwing', async () => {
      await expect(main({ phaseId: '' })).resolves.toEqual(
        expect.objectContaining({ phaseId: '' })
      );
    });

    it('handles a phaseId containing special characters', async () => {
      const result = await main({ phaseId: 'phase-5/checkpoint#3' });
      expect(result.phaseId).toBe('phase-5/checkpoint#3');
    });

    it('handles a very long phaseId string', async () => {
      const longId = 'phase-'.repeat(200);
      const result = await main({ phaseId: longId });
      expect(result.phaseId).toBe(longId);
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

    it('logs the phase being rolled back', async () => {
      await main({ phaseId: 'phase-7' });
      expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('phase-7'));
    });

    it('logs exactly once per invocation', async () => {
      await main({ phaseId: 'phase-7' });
      expect(logSpy).toHaveBeenCalledTimes(1);
    });
  });

  describe('isolation and concurrency', () => {
    it('produces independent results across sequential calls', async () => {
      const first = await main({ phaseId: 'phase-1' });
      const second = await main({ phaseId: 'phase-2' });
      expect(first.phaseId).toBe('phase-1');
      expect(second.phaseId).toBe('phase-2');
    });

    it('resolves each call in a concurrent batch with its own phaseId', async () => {
      const ids = ['phase-a', 'phase-b', 'phase-c'];
      const results = await Promise.all(ids.map(phaseId => main({ phaseId })));
      expect(results.map(r => r.phaseId)).toEqual(ids);
    });

    it('is idempotent: calling twice with the same input yields equal results', async () => {
      const first = await main({ phaseId: 'phase-9' });
      const second = await main({ phaseId: 'phase-9' });
      expect(first).toEqual(second);
    });
  });

  describe('module exports', () => {
    it('exposes the same function as default and named export', () => {
      expect(main).toBe(namedMain);
    });
  });
});
