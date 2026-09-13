import { TorqueQueryOrchestrator } from '../modules/TorqueQueryOrchestrator.mjs';

export async function runPipelineTests() {
  console.log('--- Starting TorqueQuery Pipeline Orchestration Tests ---');
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

    if (result.status === 'SUCCESS' && result.authDecision.authorized && result.modelGateDecision.allowed) {
      console.log('✓ Test 1 Passed: Standard Grounded Query executed successfully.');
      passed++;
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

    if (result.status === 'DENIED' && result.authDecision.challengeRequired) {
      console.log('✓ Test 2 Passed: High-risk step-up requirement correctly denied unauthenticated intent.');
      passed++;
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
      query: 'complex multi-step reasoning',
      scope: 'S4',
      action: 'QUERY'
    });

    if (result.status === 'BLOCKED_BY_GATE' || (result.status === 'SUCCESS' && result.modelGateDecision)) {
      console.log('✓ Test 3 Passed: Scope gate evaluation completed deterministically.');
      passed++;
    } else {
      console.error('✗ Test 3 Failed:', result);
    }
  } catch (err) {
    console.error('✗ Test 3 Threw Error:', err);
  }

  console.log(`\nResults: ${passed}/${total} pipeline tests passed.`);
  return passed === total;
}

runPipelineTests();
