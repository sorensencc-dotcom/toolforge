import { TorqueQueryOrchestrator } from '../modules/TorqueQueryOrchestrator.mjs';

export async function runPipelineTests() {
  console.log('--- Starting TorqueQuery Pipeline Orchestration & Observability Tests ---');
  let passed = 0;
  let total = 0;

  const orchestrator = new TorqueQueryOrchestrator();

  // Test 1: Standard Grounded Query (Authorized + S1 Scope)
  total++;
  try {
    const result = await orchestrator.execute({
      query: 'federated addressing sigil',
      action: 'QUERY',
      scope: 'S1',
      requiresStepUp: false
    });

    if (result.status === 'SUCCESS' && result.authDecision.authorized && result.modelGateDecision.allowed && result.telemetry) {
      if (result.telemetry.queryShape === 'fuzzy' && result.telemetry.deterministicAudit === true) {
        console.log('✓ Test 1 Passed: Standard Grounded Query executed with valid telemetry.');
        passed++;
      } else {
        console.error('✗ Test 1 Failed: Telemetry shape/audit mismatch:', result.telemetry);
      }
    } else {
      console.error('✗ Test 1 Failed:', result);
    }
  } catch (err) {
    console.error('✗ Test 1 Threw Error:', err);
  }

  // Test 2: High-Risk Action Requiring Step-Up (Unauthenticated session -> DENIED)
  total++;
  try {
    const result = await orchestrator.execute({
      query: 'purge database index',
      action: 'PURGE',
      scope: 'CRITICAL',
      requiresStepUp: true
    });

    if (result.status === 'DENIED' && result.authDecision.challengeRequired && result.telemetry) {
      if (result.telemetry.driftStatus === 'MISS') {
        console.log('✓ Test 2 Passed: High-risk step-up requirement correctly denied with telemetry.');
        passed++;
      } else {
        console.error('✗ Test 2 Failed: Unexpected driftStatus in denied intent');
      }
    } else {
      console.error('✗ Test 2 Failed:', result);
    }
  } catch (err) {
    console.error('✗ Test 2 Threw Error:', err);
  }

  // Test 3: Model Scope Gate Enforcement
  total++;
  try {
    const customOrchestrator = new TorqueQueryOrchestrator({
      whichLlmOptions: { selectionFilePath: 'non_existent_mock.json' }
    });

    const result = await customOrchestrator.execute({
      query: '"exact matching query"',
      scope: 'S4',
      action: 'QUERY'
    });

    if (result.status === 'BLOCKED_BY_GATE' || (result.status === 'SUCCESS' && result.modelGateDecision)) {
      if (result.telemetry && result.telemetry.queryShape === 'exact') {
        console.log('✓ Test 3 Passed: Exact query shape classified and scope gate evaluated.');
        passed++;
      } else {
        console.error('✗ Test 3 Failed: Query shape not classified as exact:', result.telemetry);
      }
    } else {
      console.error('✗ Test 3 Failed:', result);
    }
  } catch (err) {
    console.error('✗ Test 3 Threw Error:', err);
  }

  // Test 4: Observability Telemetry Aggregation & Query Shapes
  total++;
  try {
    // Run prefix query and empty query to populate histogram
    await orchestrator.execute({ query: 'tag:research*', action: 'QUERY', scope: 'S1' });
    await orchestrator.execute({ query: '', action: 'QUERY', scope: 'S1' });

    const report = orchestrator.getTelemetryReport();
    if (
      report.totalQueries >= 4 &&
      report.queryShapeHistogram.fuzzy >= 1 &&
      report.queryShapeHistogram.prefix >= 1 &&
      report.queryShapeHistogram.empty >= 1 &&
      report.determinismAudits.verified >= 1 &&
      typeof report.avgLatencyMs === 'number'
    ) {
      console.log('✓ Test 4 Passed: Observability telemetry report aggregated histogram & latency buckets correctly.');
      passed++;
    } else {
      console.error('✗ Test 4 Failed: Invalid telemetry report:', report);
    }
  } catch (err) {
    console.error('✗ Test 4 Threw Error:', err);
  }

  // Test 5: Metrics Reset Verification
  total++;
  try {
    orchestrator.resetMetrics();
    const resetReport = orchestrator.getTelemetryReport();
    if (resetReport.totalQueries === 0 && resetReport.avgLatencyMs === 0 && resetReport.driftCounters.hits === 0) {
      console.log('✓ Test 5 Passed: Metrics reset cleans telemetry counters completely.');
      passed++;
    } else {
      console.error('✗ Test 5 Failed: Metrics reset failed:', resetReport);
    }
  } catch (err) {
    console.error('✗ Test 5 Threw Error:', err);
  }

  console.log(`\nResults: ${passed}/${total} pipeline tests passed.`);
  return passed === total;
}

runPipelineTests().then(ok => {
  if (!ok) process.exit(1);
});
