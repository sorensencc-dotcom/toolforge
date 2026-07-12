import { describe, it, expect } from '@jest/globals';
import main from '../src/index';

describe('Analyze Token Burn', () => {
  describe('main function', () => {
    it('should return object with burnRate, prediction, status', async () => {
      const result = await main({});
      expect(result).toHaveProperty('burnRate');
      expect(result).toHaveProperty('prediction');
      expect(result).toHaveProperty('status');
    });

    it('should accept sessionId parameter', async () => {
      const result = await main({ sessionId: 'test-123' });
      expect(result.status).toBeDefined();
    });

    it('should accept lookbackDays parameter', async () => {
      const result = await main({ lookbackDays: 7 });
      expect(result.prediction).toBeDefined();
    });

    it('should handle empty input', async () => {
      const result = await main({});
      expect(result.burnRate).toEqual(0);
    });

    it('should return string prediction', async () => {
      const result = await main({});
      expect(typeof result.prediction).toBe('string');
    });

    it('should return string status', async () => {
      const result = await main({});
      expect(typeof result.status).toBe('string');
    });

    it('should return numeric burnRate', async () => {
      const result = await main({});
      expect(typeof result.burnRate).toBe('number');
    });
  });
});
