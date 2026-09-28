import { test } from 'node:test';
import assert from 'node:assert/strict';
import { generateGateStatusMarkdown } from '../scripts/generate-gate-status.mjs';

test('renders one row per gate with its closure amendment', () => {
  const gateRegistry = {
    status: 'STABLE / SEALED',
    gates: {
      'GATE-01': { name: 'Artifact-Store Transaction / Rollback', status: 'CLOSED', closure_amendment: 'AMD-v2.4.0-GATE-01-CLOSED' },
      'GATE-05': { name: 'Open-Gate Rejection', status: 'CLOSED', closure_amendment: 'AMD-v2.4.0-GATE-05-CLOSED' },
    },
  };
  const amendmentRegistry = { status: 'DRAFT', amendments: [] };
  const runtimeStatus = { status: 'OPERATIONAL' };

  const md = generateGateStatusMarkdown({ gateRegistry, amendmentRegistry, runtimeStatus });

  assert.match(md, /GATE-01/);
  assert.match(md, /AMD-v2\.4\.0-GATE-01-CLOSED/);
  assert.match(md, /GATE-05/);
  assert.match(md, /Gate registry status: STABLE \/ SEALED/);
  assert.match(md, /Runtime status \(runtime-status\.json\): OPERATIONAL/);
});

test('flags a gate with no closure amendment as OPEN, not silently omitted', () => {
  const gateRegistry = {
    status: 'CANDIDATE',
    gates: { 'GATE-09': { name: 'Hypothetical Open Gate', status: 'OPEN' } },
  };
  const md = generateGateStatusMarkdown({
    gateRegistry,
    amendmentRegistry: { status: 'DRAFT', amendments: [] },
    runtimeStatus: { status: 'CANDIDATE' },
  });
  assert.match(md, /GATE-09.*OPEN/);
});
