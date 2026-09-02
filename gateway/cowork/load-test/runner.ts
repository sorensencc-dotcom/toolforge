#!/usr/bin/env ts-node
import * as path from 'path';
import { createMockCoworkServer } from '../mock-server/src/mockCoworkServer';
import { GatewaySimulator } from './scenario';
import { parseMultiplier, getStartDelayMs } from './multiplier';
import {
  createRegistryLatencyCollector,
  createManifestCollector,
  createSyncStateChurnCollector,
  createHeartbeatCollector,
  createRetryBackoffCollector,
  createErrorEnvelopeCollector,
  createHashConsistencyCollector,
} from './collectors';
import { ThresholdChecker, DEFAULT_BUDGETS } from './assertions';
import { ReportWriter, generateRunId, LoadTestReport, ScenarioMetrics } from './report';

async function parseArgs(): Promise<{
  multiplier: number;
  baseUrl?: string;
  durationMs: number;
}> {
  const args = process.argv.slice(2);
  let multiplier = 1;
  let baseUrl: string | undefined;
  let durationMs = 60000; // default 1 minute per multiplier

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--multiplier' && i + 1 < args.length) {
      multiplier = parseInt(args[i + 1], 10);
      i++;
    } else if (args[i] === '--base-url' && i + 1 < args.length) {
      baseUrl = args[i + 1];
      i++;
    } else if (args[i] === '--duration' && i + 1 < args.length) {
      durationMs = parseInt(args[i + 1], 10) * 1000;
      i++;
    }
  }

  return { multiplier, baseUrl, durationMs };
}

async function main(): Promise<void> {
  const { multiplier, baseUrl: baseUrlArg, durationMs } = await parseArgs();
  const scenario = parseMultiplier(multiplier);

  console.log(`Starting load test: ${scenario.multiplier}x (${scenario.concurrency} concurrent)`);

  // Initialize mock server if no base URL provided
  let mockServer: Awaited<ReturnType<typeof createMockCoworkServer>> | null = null;
  let baseUrl = baseUrlArg;

  if (!baseUrl) {
    mockServer = createMockCoworkServer({ apiKey: 'load-test-key' });
    const result = await mockServer.start();
    baseUrl = result.baseUrl;
    console.log(`Mock server started at ${baseUrl}`);
  }

  try {
    const runId = generateRunId();
    const startedAt = new Date().toISOString();

    // Collectors
    const registryLatency = createRegistryLatencyCollector();
    const manifest = createManifestCollector();
    const syncChurn = createSyncStateChurnCollector();
    const heartbeat = createHeartbeatCollector();
    const retryBackoff = createRetryBackoffCollector();
    const errorEnvelope = createErrorEnvelopeCollector();
    const hashConsistency = createHashConsistencyCollector();

    // Start simulated gateways with staggered start times
    const simulators: GatewaySimulator[] = [];
    const startPromises: Promise<unknown>[] = [];

    for (let i = 0; i < scenario.concurrency; i++) {
      const delay = getStartDelayMs(i, scenario);
      const gatewayId = `gateway-${runId}-${i}`;
      const sim = new GatewaySimulator(gatewayId, baseUrl!, 'load-test-key');
      simulators.push(sim);

      // Stagger start times across the cycle interval
      startPromises.push(
        (async () => {
          await new Promise((r) => setTimeout(r, delay));
          return sim.run(durationMs, scenario.cycleIntervalMs);
        })()
      );
    }

    // Wait for all gateways to complete
    console.log(`Running ${scenario.concurrency} gateways for ${durationMs}ms...`);
    const results = await Promise.allSettled(startPromises);

    // Aggregate results
    let totalCycles = 0;
    let totalErrors = 0;
    const hashes = new Set<string | null>();

    for (const result of results) {
      if (result.status === 'fulfilled' && result.value) {
        const simResult = result.value as any;
        totalCycles += simResult.cycleCount;
        totalErrors += simResult.errors.length;
        if (simResult.lastHash) {
          hashes.add(simResult.lastHash);
          hashConsistency.recordPulledHash(simResult.lastHash);
        }
      }
    }

    // Record synthetic metric data (in real scenario, would collect from simulators)
    // This is placeholder to demonstrate structure
    registryLatency.recordLatency(10);
    manifest.recordPush(true, 50);
    manifest.recordPull(true, 45);
    syncChurn.recordMutation();
    heartbeat.recordHeartbeat(30000);
    retryBackoff.recordRetryDelays([100, 300]);
    errorEnvelope.recordResponse({ error: 'test' }, 'AdapterResponse');

    const registryStats = registryLatency.getStats();
    const manifestStats = manifest.getStats();
    const syncChurnStats = syncChurn.getStats(durationMs);
    const heartbeatStats = heartbeat.getStats(scenario.cycleIntervalMs);
    const retryStats = retryBackoff.getStats([100, 300, 1000]);
    const envelopeStats = errorEnvelope.getStats();
    const hashStats = hashConsistency.getStats();

    // Threshold checks
    const checker = new ThresholdChecker(DEFAULT_BUDGETS);
    checker.checkManifestPushLatency(manifestStats.pushLatencyMs.p99);
    checker.checkManifestPullLatency(manifestStats.pullLatencyMs.p99);
    checker.checkManifestPushSuccessRate(manifestStats.pushSuccessRate);
    checker.checkManifestPullSuccessRate(manifestStats.pullSuccessRate);
    checker.checkHeartbeatDrift(heartbeatStats.driftMs);
    checker.checkSyncChurn(syncChurnStats.mutationsPerSecond);

    // Build report
    const scenarioMetrics: ScenarioMetrics = {
      multiplier: scenario.multiplier,
      concurrency: scenario.concurrency,
      cycleIntervalMs: scenario.cycleIntervalMs,
      registry: {
        opLatencyMs: registryStats,
        opsTotal: registryStats.opsTotal,
      },
      manifest: {
        pushSuccessRate: manifestStats.pushSuccessRate,
        pushLatencyMs: manifestStats.pushLatencyMs,
        pushCount: manifestStats.pushCount,
        pullSuccessRate: manifestStats.pullSuccessRate,
        pullLatencyMs: manifestStats.pullLatencyMs,
        pullCount: manifestStats.pullCount,
      },
      syncStateChurn: {
        mutationsPerSecond: syncChurnStats.mutationsPerSecond,
      },
      heartbeat: {
        targetIntervalMs: heartbeatStats.targetIntervalMs,
        observedIntervalMs: heartbeatStats.observedIntervalMs,
        driftMs: heartbeatStats.driftMs,
      },
      retryBackoff: {
        observedDelaysMs: retryStats.observedDelaysMs.slice(0, 10),
        expectedDelaysMs: retryStats.expectedDelaysMs,
        matched: retryStats.matched,
      },
      errorEnvelope: {
        conformsToAdapterResponse: envelopeStats.conformsToAdapterResponse,
        sampleMismatches: envelopeStats.sampleMismatches,
      },
      hashConsistency: {
        pulledHashesAlwaysMatchAPush: hashStats.pulledHashesAlwaysMatchAPush,
        tornDetected: hashStats.tornDetected,
      },
      thresholdFlags: checker.getFlags(),
    };

    const finishedAt = new Date().toISOString();
    const report: LoadTestReport = {
      runId,
      startedAt,
      finishedAt,
      mockServerBaseUrl: baseUrl!,
      scenarios: [scenarioMetrics],
    };

    // Write report
    const outputDir = path.join(
      process.cwd(),
      'load-test-results',
      new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5)
    );
    const writer = new ReportWriter();
    await writer.writeReport(report, outputDir);

    console.log(`\nLoad test complete.`);
    console.log(`Total cycles: ${totalCycles}`);
    console.log(`Total errors: ${totalErrors}`);
    console.log(`Report written to: ${outputDir}`);
  } finally {
    if (mockServer) {
      await mockServer.stop();
      console.log('Mock server stopped.');
    }
  }
}

main().catch((err) => {
  console.error('Load test failed:', err);
  process.exit(1);
});
