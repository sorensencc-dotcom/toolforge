import scaleIngestionService, { main } from '../src/index';

describe('Scale Ingestion Service', () => {
  describe('Happy Path', () => {
    it('scales to the default replica count when no input is given', async () => {
      const result = await main({});
      expect(result.replicas).toBe(1);
      expect(result.status).toBe('stub');
    });

    it('scales to the specified target replica count', async () => {
      const result = await main({ targetReplicas: 5 });
      expect(result.replicas).toBe(5);
    });

    it('accepts a serviceId alongside targetReplicas without altering the scaling result', async () => {
      const result = await main({ targetReplicas: 3, serviceId: 'rl-ingest-01' });
      expect(result.replicas).toBe(3);
      expect(result.status).toBe('stub');
    });
  });

  describe('Load Scenarios', () => {
    it('handles a high target replica count (large-scale load scenario)', async () => {
      const result = await main({ targetReplicas: 500 });
      expect(result.replicas).toBe(500);
    });

    it('handles the minimum valid replica count of 1', async () => {
      const result = await main({ targetReplicas: 1 });
      expect(result.replicas).toBe(1);
    });

    it('handles fractional replica requests by passing the value through unchanged', async () => {
      const result = await main({ targetReplicas: 2.5 });
      expect(result.replicas).toBe(2.5);
    });
  });

  describe('Backpressure Fallback Behavior', () => {
    it('falls back to the default replica count when targetReplicas is 0', async () => {
      // 0 is falsy, so the `input.targetReplicas || 1` guard floors it to 1 —
      // this is the current backpressure-safe floor behavior of the stub.
      const result = await main({ targetReplicas: 0 });
      expect(result.replicas).toBe(1);
    });

    it('passes negative targetReplicas through without validation (no clamping in current implementation)', async () => {
      const result = await main({ targetReplicas: -3 });
      expect(result.replicas).toBe(-3);
    });
  });

  describe('Error Recovery / Invalid Input Handling', () => {
    it('does not throw when called with an empty object', async () => {
      await expect(main({})).resolves.toBeDefined();
    });

    it('does not throw and falls back to default when targetReplicas is NaN', async () => {
      const result = await main({ targetReplicas: NaN });
      expect(result.replicas).toBe(1);
    });

    it('does not throw when serviceId is missing', async () => {
      const result = await main({ targetReplicas: 4 });
      expect(result).toBeDefined();
      expect(result.replicas).toBe(4);
    });
  });

  describe('Concurrency', () => {
    it('resolves concurrent invocations independently without cross-call state leakage', async () => {
      const [a, b, c] = await Promise.all([
        main({ targetReplicas: 2 }),
        main({ targetReplicas: 7 }),
        main({ targetReplicas: 10 }),
      ]);
      expect(a.replicas).toBe(2);
      expect(b.replicas).toBe(7);
      expect(c.replicas).toBe(10);
    });
  });

  describe('Output Contract', () => {
    it('returns the documented stub shape until real scaling orchestration is implemented', async () => {
      const result = await main({ targetReplicas: 8 });
      expect(result).toEqual({ scaled: false, replicas: 8, status: 'stub' });
      expect(typeof result.scaled).toBe('boolean');
      expect(typeof result.replicas).toBe('number');
      expect(typeof result.status).toBe('string');
    });

    it('exposes the same function as both the named export and the default export', async () => {
      expect(scaleIngestionService).toBe(main);
      const result = await scaleIngestionService({ targetReplicas: 6 });
      expect(result.replicas).toBe(6);
    });
  });
});
