import {
  MistralLargeChonkBenchmark,
  runMistralLargeChonkBenchmark,
  PRICING_PROFILES,
} from '../src/benchmark-engine';

describe('Benchmark Mistral Large Chonk (ACT-02)', () => {
  let benchmark: MistralLargeChonkBenchmark;

  beforeEach(() => {
    benchmark = new MistralLargeChonkBenchmark();
  });

  describe('Benchmark Scenarios', () => {
    test('executes needle retrieval scenario on chonk context buffer', async () => {
      const res = await benchmark.runNeedleRetrievalScenario(16000, 1);
      expect(res.name).toBe('needle_retrieval');
      expect(res.category).toBe('chonk_context_retrieval');
      expect(res.score).toBeGreaterThan(90);
      expect(res.details.retrievalAccurate).toBe(true);
      expect(res.costUsd).toBeLessThan(res.frontierCostUsd);
    });

    test('executes AST refactoring scenario', async () => {
      const res = await benchmark.runAstRefactorScenario(1);
      expect(res.name).toBe('ast_refactor');
      expect(res.category).toBe('code_refactoring');
      expect(res.score).toBeGreaterThan(85);
      expect(res.details.syntaxValid).toBe(true);
    });

    test('executes formal invariant synthesis scenario', async () => {
      const res = await benchmark.runInvariantSynthesisScenario(1);
      expect(res.name).toBe('invariant_synthesis');
      expect(res.category).toBe('formal_methods');
      expect(res.score).toBeGreaterThanOrEqual(90);
      expect(res.details.validTacticProof).toBe(true);
    });
  });

  describe('Full Suite Execution & Arbitrage', () => {
    test('runs full benchmark suite and asserts PASS status with 80%+ savings', async () => {
      const report = await benchmark.runBenchmark({
        workload: 'all',
        contextSizeTokens: 16000,
        iterations: 1,
      });

      expect(report.status).toBe('PASS');
      expect(report.modelEvaluated).toBe(PRICING_PROFILES.mistral_large.name);
      expect(report.overallScore).toBeGreaterThanOrEqual(85);
      expect(report.scenarios.length).toBe(3);
      expect(report.costSavingsVsFrontierPct).toBeGreaterThan(80.0);
      expect(report.totalCostUsd).toBeLessThan(report.totalFrontierBaselineCostUsd);
    });

    test('executes programmatic runner helper', async () => {
      const report = await runMistralLargeChonkBenchmark({
        workload: 'needle_retrieval',
        iterations: 1,
      });

      expect(report.status).toBe('PASS');
      expect(report.scenarios.length).toBe(1);
    });
  });
});
