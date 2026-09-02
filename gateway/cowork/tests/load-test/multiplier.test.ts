import { parseMultiplier, getStartDelayMs } from '../../load-test/multiplier';

describe('Multiplier', () => {
  it('parses 1x to 5 concurrent gateways', () => {
    const scenario = parseMultiplier(1);
    expect(scenario.multiplier).toBe(1);
    expect(scenario.concurrency).toBe(5);
    expect(scenario.cycleIntervalMs).toBe(30000);
  });

  it('parses 10x to 50 concurrent gateways', () => {
    const scenario = parseMultiplier(10);
    expect(scenario.concurrency).toBe(50);
  });

  it('parses 100x to 500 concurrent gateways', () => {
    const scenario = parseMultiplier(100);
    expect(scenario.concurrency).toBe(500);
  });

  it('parses 500x to 2500 concurrent gateways', () => {
    const scenario = parseMultiplier(500);
    expect(scenario.concurrency).toBe(2500);
  });

  it('rejects invalid multipliers', () => {
    expect(() => parseMultiplier(2)).toThrow();
    expect(() => parseMultiplier(50)).toThrow();
  });

  it('calculates start delay for staggered gateway startup', () => {
    const scenario1x = parseMultiplier(1);
    expect(getStartDelayMs(0, scenario1x)).toBe(0);
    expect(getStartDelayMs(1, scenario1x)).toBe(6000);
    expect(getStartDelayMs(2, scenario1x)).toBe(12000);
    expect(getStartDelayMs(3, scenario1x)).toBe(18000);
    expect(getStartDelayMs(4, scenario1x)).toBe(24000);

    const scenario10x = parseMultiplier(10);
    const delayPer = 30000 / 50;
    expect(getStartDelayMs(0, scenario10x)).toBe(0);
    expect(getStartDelayMs(1, scenario10x)).toBe(delayPer);
    expect(getStartDelayMs(49, scenario10x)).toBe(delayPer * 49);
  });

  it('accepts numeric and string multipliers', () => {
    const num = parseMultiplier(1);
    const str = parseMultiplier('1');
    expect(num).toEqual(str);
  });
});
