import {
  MistralLargeChonkBenchmark,
  BenchmarkOptions,
  BenchmarkReport,
} from './benchmark-engine';

export * from './benchmark-engine';

/**
 * Programmatic invocation entrypoint.
 */
export async function runMistralLargeChonkBenchmark(
  options: BenchmarkOptions = {}
): Promise<BenchmarkReport> {
  const runner = new MistralLargeChonkBenchmark();
  return runner.runBenchmark(options);
}

// Direct CLI entrypoint
if (process.argv[1] && (process.argv[1].endsWith('index.js') || process.argv[1].endsWith('index.ts'))) {
  const args = process.argv.slice(2);
  const workload = (args[0] as any) || 'all';
  const contextSize = args[1] ? parseInt(args[1], 10) : 32000;

  runMistralLargeChonkBenchmark({ workload, contextSizeTokens: contextSize })
    .then((report) => {
      console.log(JSON.stringify(report, null, 2));
      process.exit(report.status === 'FAIL' ? 1 : 0);
    })
    .catch((err) => {
      console.error('[Benchmark Error]', err);
      process.exit(1);
    });
}
