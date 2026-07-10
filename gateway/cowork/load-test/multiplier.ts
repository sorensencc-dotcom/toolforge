/**
 * Concurrency multiplier model.
 * Maps abstract multiplier (1x/10x/100x/500x) to concrete concurrency count.
 */

export interface MultiplierScenario {
  multiplier: number;
  concurrency: number;
  cycleIntervalMs: number;
}

const BASELINE_CONCURRENCY = 5;
const BASELINE_CYCLE_INTERVAL_MS = 30000;

export function parseMultiplier(multiplier: string | number): MultiplierScenario {
  const m = typeof multiplier === 'string' ? parseInt(multiplier, 10) : multiplier;
  if (![1, 10, 100, 500].includes(m)) {
    throw new Error(`Invalid multiplier: ${m}. Expected 1, 10, 100, or 500.`);
  }

  return {
    multiplier: m,
    concurrency: BASELINE_CONCURRENCY * m,
    cycleIntervalMs: BASELINE_CYCLE_INTERVAL_MS,
  };
}

export function getStartDelayMs(gatewayIndex: number, scenario: MultiplierScenario): number {
  return (gatewayIndex * scenario.cycleIntervalMs) / scenario.concurrency;
}
