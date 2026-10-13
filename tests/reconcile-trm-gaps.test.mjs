import { test } from 'node:test';
import assert from 'node:assert/strict';
import { reconcileNotebookFindings } from '../scripts/reconcile-trm-gaps.mjs';

test('reconcileNotebookFindings - returns 0 when findings are missing or undefined', () => {
  assert.equal(reconcileNotebookFindings(null), 0);
  assert.equal(reconcileNotebookFindings({}), 0);
  assert.equal(reconcileNotebookFindings({ trm_intelligence: {} }), 0);
  assert.equal(reconcileNotebookFindings({ trm_intelligence: { notebook_findings: {} } }), 0);
});

test('reconcileNotebookFindings - reconciles Ford Executive Dynamics & Politics (0caf6707)', () => {
  const fordId = '0caf6707-f8f2-4d2a-acd2-020acead55ba';
  const mockData = {
    trm_intelligence: {
      notebook_findings: {
        [fordId]: {
          extraction_status: 'COMPLETE (20 Vectors Mined)',
          contradictions: [
            { title: 'Contradiction 1', desc: 'Old 1', status: 'OPEN', resolved: false },
            { title: 'Contradiction 2', desc: 'Old 2', status: 'OPEN', resolved: false },
            { title: 'Contradiction 3', desc: 'Old 3', status: 'OPEN', resolved: false },
            { title: 'Contradiction 4', desc: 'Old 4', status: 'OPEN', resolved: false },
            { title: 'Contradiction 5', desc: 'Old 5', status: 'OPEN', resolved: false }
          ],
          undersourced: [
            { title: 'Undersourced 1', desc: 'Old 1', status: 'OPEN', resolved: false },
            { title: 'Undersourced 2', desc: 'Old 2', status: 'OPEN', resolved: false },
            { title: 'Undersourced 3', desc: 'Old 3', status: 'OPEN', resolved: false },
            { title: 'Undersourced 4', desc: 'Old 4', status: 'OPEN', resolved: false },
            { title: 'Undersourced 5', desc: 'Old 5', status: 'OPEN', resolved: false }
          ]
        }
      }
    }
  };

  const changes = reconcileNotebookFindings(mockData);
  assert.equal(changes, 10);

  const findings = mockData.trm_intelligence.notebook_findings[fordId];
  assert.equal(findings.extraction_status, 'RESOLVED (20 Vectors Reconciled)');
  assert.equal(findings.contradictions.length, 5);
  assert.equal(findings.undersourced.length, 5);

  for (const c of findings.contradictions) {
    assert.equal(c.status, 'RESOLVED');
    assert.equal(c.resolved, true);
    assert.ok(c.title.includes('[RECONCILED:'));
    assert.ok(c.desc.startsWith('RECONCILED (2026-10-12):'));
  }

  for (const u of findings.undersourced) {
    assert.equal(u.status, 'RESOLVED');
    assert.equal(u.resolved, true);
    assert.ok(u.title.includes('[RECONCILED:'));
    assert.ok(u.desc.startsWith('RECONCILED (2026-10-12):'));
  }
});

test('reconcileNotebookFindings - reconciles Willow Run Videos findings (ef78168d)', () => {
  const wrId = 'ef78168d-b7b9-4952-8e0f-fcb353a21181';
  const mockData = {
    trm_intelligence: {
      notebook_findings: {
        [wrId]: {
          extraction_status: 'COMPLETE (14 Vectors Mined)',
          contradictions: Array.from({ length: 6 }, (_, i) => ({
            title: `Contradiction ${i + 1}`,
            desc: `Old WR ${i + 1}`,
            status: 'OPEN',
            resolved: false
          })),
          undersourced: Array.from({ length: 8 }, (_, i) => ({
            title: `Undersourced ${i + 1}`,
            desc: `Old WR Under ${i + 1}`,
            status: 'OPEN',
            resolved: false
          }))
        }
      }
    }
  };

  const changes = reconcileNotebookFindings(mockData);
  assert.equal(changes, 14);

  const findings = mockData.trm_intelligence.notebook_findings[wrId];
  assert.equal(findings.extraction_status, 'RESOLVED (14 Vectors Reconciled)');
  assert.equal(findings.contradictions.length, 6);
  assert.equal(findings.undersourced.length, 8);

  for (const c of findings.contradictions) {
    assert.equal(c.status, 'RESOLVED');
    assert.equal(c.resolved, true);
    assert.ok(c.title.includes('[RECONCILED:'));
  }

  for (const u of findings.undersourced) {
    assert.equal(u.status, 'RESOLVED');
    assert.equal(u.resolved, true);
    assert.ok(u.title.includes('[RECONCILED:'));
  }
});

test('reconcileNotebookFindings - idempotent when run repeatedly', () => {
  const fordId = '0caf6707-f8f2-4d2a-acd2-020acead55ba';
  const mockData = {
    trm_intelligence: {
      notebook_findings: {
        [fordId]: {
          extraction_status: 'COMPLETE',
          contradictions: [{ title: 'C1', desc: 'D1' }],
          undersourced: [{ title: 'U1', desc: 'D1' }]
        }
      }
    }
  };

  const firstRun = reconcileNotebookFindings(mockData);
  assert.equal(firstRun, 2);

  const secondRun = reconcileNotebookFindings(mockData);
  assert.equal(secondRun, 2);
  assert.equal(mockData.trm_intelligence.notebook_findings[fordId].extraction_status, 'RESOLVED (20 Vectors Reconciled)');
});
