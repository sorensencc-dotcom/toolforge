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

test('reconcileNotebookFindings - reconciles Willys-Overland findings (fd4ebe29)', () => {
  const willysId = 'fd4ebe29-9440-4f4b-97cf-0184ffbe29a0';
  const mockData = {
    trm_intelligence: {
      notebook_findings: {
        [willysId]: {
          contradictions: [{ title: 'What open questions exist?', desc: 'None' }],
          undersourced: [{ title: 'What claims are single sourced?', desc: 'None' }]
        }
      }
    }
  };

  const changes = reconcileNotebookFindings(mockData);
  assert.equal(changes, 2);

  const findings = mockData.trm_intelligence.notebook_findings[willysId];
  assert.equal(findings.extraction_status, 'RESOLVED (2 Vectors Reconciled)');
  assert.equal(findings.contradictions[0].status, 'RESOLVED');
  assert.equal(findings.contradictions[0].resolved, true);
  assert.ok(findings.contradictions[0].title.includes('[RECONCILED: VERIFIED CLEAN]'));
  assert.equal(findings.undersourced[0].status, 'RESOLVED');
  assert.equal(findings.undersourced[0].resolved, true);
  assert.ok(findings.undersourced[0].title.includes('[RECONCILED: CORROBORATED]'));
});

test('reconcileNotebookFindings - reconciles Cuban Seizures & Retired Assets findings (c8360946)', () => {
  const cubanId = 'c8360946-dbee-4a2c-b622-7f89b05695b0';
  const mockData = {
    trm_intelligence: {
      notebook_findings: {
        [cubanId]: {
          contradictions: Array.from({ length: 5 }, (_, i) => ({
            title: `Contradiction ${i + 1}`,
            desc: `Old Cuban ${i + 1}`,
            status: 'OPEN',
            resolved: false
          })),
          undersourced: Array.from({ length: 6 }, (_, i) => ({
            title: `Undersourced ${i + 1}`,
            desc: `Old Cuban Under ${i + 1}`,
            status: 'OPEN',
            resolved: false
          }))
        }
      }
    }
  };

  const changes = reconcileNotebookFindings(mockData);
  assert.equal(changes, 11);

  const findings = mockData.trm_intelligence.notebook_findings[cubanId];
  assert.equal(findings.extraction_status, 'RESOLVED (11 Vectors Reconciled)');
  assert.equal(findings.contradictions.length, 5);
  assert.equal(findings.undersourced.length, 6);

  for (const c of findings.contradictions) {
    assert.equal(c.status, 'RESOLVED');
    assert.equal(c.resolved, true);
    assert.ok(c.title.includes('[RECONCILED:'));
    assert.ok(c.desc.startsWith('RECONCILED (2026-10-13):'));
  }

  for (const u of findings.undersourced) {
    assert.equal(u.status, 'RESOLVED');
    assert.equal(u.resolved, true);
    assert.ok(u.title.includes('[RECONCILED:'));
    assert.ok(u.desc.startsWith('RECONCILED (2026-10-13):'));
  }
});

test('reconcileNotebookFindings - reconciles CIC - Daily Research findings (1b4861a3)', () => {
  const dailyId = '1b4861a3-931f-4632-8fc1-343a8dd37df8';
  const mockData = {
    trm_intelligence: {
      notebook_findings: {
        [dailyId]: {
          contradictions: Array.from({ length: 4 }, (_, i) => ({
            title: `Contradiction ${i + 1}`,
            desc: `Old Daily C ${i + 1}`,
            status: 'OPEN',
            resolved: false
          })),
          undersourced: Array.from({ length: 6 }, (_, i) => ({
            title: `Undersourced ${i + 1}`,
            desc: `Old Daily U ${i + 1}`,
            status: 'OPEN',
            resolved: false
          }))
        }
      }
    }
  };

  const changes = reconcileNotebookFindings(mockData);
  assert.equal(changes, 10);

  const findings = mockData.trm_intelligence.notebook_findings[dailyId];
  assert.equal(findings.extraction_status, 'RESOLVED (10 Vectors Reconciled)');
  assert.equal(findings.contradictions.length, 4);
  assert.equal(findings.undersourced.length, 6);

  for (const c of findings.contradictions) {
    assert.equal(c.status, 'RESOLVED');
    assert.equal(c.resolved, true);
    assert.ok(c.title.includes('[RECONCILED:'));
    assert.ok(c.desc.startsWith('RECONCILED (2026-10-13):'));
  }

  for (const u of findings.undersourced) {
    assert.equal(u.status, 'RESOLVED');
    assert.equal(u.resolved, true);
    assert.ok(u.title.includes('[RECONCILED:'));
    assert.ok(u.desc.startsWith('RECONCILED (2026-10-13):'));
  }
});

test('reconcileNotebookFindings - reconciles Cast Iron Charlie - Research Logs findings (b8bc161d)', () => {
  const logsId = 'b8bc161d-495f-42f9-a7d1-ed8692141f6b';
  const mockData = {
    trm_intelligence: {
      notebook_findings: {
        [logsId]: {
          contradictions: Array.from({ length: 4 }, (_, i) => ({
            title: `Contradiction ${i + 1}`,
            desc: `Old Logs C ${i + 1}`,
            status: 'OPEN',
            resolved: false
          })),
          undersourced: Array.from({ length: 6 }, (_, i) => ({
            title: `Undersourced ${i + 1}`,
            desc: `Old Logs U ${i + 1}`,
            status: 'OPEN',
            resolved: false
          }))
        }
      }
    }
  };

  const changes = reconcileNotebookFindings(mockData);
  assert.equal(changes, 10);

  const findings = mockData.trm_intelligence.notebook_findings[logsId];
  assert.equal(findings.extraction_status, 'RESOLVED (10 Vectors Reconciled)');
  assert.equal(findings.contradictions.length, 4);
  assert.equal(findings.undersourced.length, 6);

  for (const c of findings.contradictions) {
    assert.equal(c.status, 'RESOLVED');
    assert.equal(c.resolved, true);
    assert.ok(c.title.includes('[RECONCILED:'));
    assert.ok(c.desc.startsWith('RECONCILED (2026-10-13):'));
  }

  for (const u of findings.undersourced) {
    assert.equal(u.status, 'RESOLVED');
    assert.equal(u.resolved, true);
    assert.ok(u.title.includes('[RECONCILED:'));
    assert.ok(u.desc.startsWith('RECONCILED (2026-10-13):'));
  }
});

test('reconcileNotebookFindings - reconciles The Sorensen Photographic Archive (fd0e0e4e)', () => {
  const photoId = 'fd0e0e4e-6890-4fb9-89bf-b9e568295e7a';
  const mockData = {
    trm_intelligence: {
      notebook_findings: {
        [photoId]: {
          contradictions: Array.from({ length: 7 }, (_, i) => ({
            title: `Contradiction ${i + 1}`,
            desc: `Old Photo C ${i + 1}`,
            status: 'OPEN',
            resolved: false
          })),
          undersourced: Array.from({ length: 1 }, (_, i) => ({
            title: `Undersourced ${i + 1}`,
            desc: `Old Photo U ${i + 1}`,
            status: 'OPEN',
            resolved: false
          }))
        }
      }
    }
  };

  const changes = reconcileNotebookFindings(mockData);
  assert.equal(changes, 8);

  const findings = mockData.trm_intelligence.notebook_findings[photoId];
  assert.equal(findings.extraction_status, 'RESOLVED (8 Vectors Reconciled)');
  assert.equal(findings.contradictions.length, 7);
  assert.equal(findings.undersourced.length, 1);

  for (const c of findings.contradictions) {
    assert.equal(c.status, 'RESOLVED');
    assert.equal(c.resolved, true);
    assert.ok(c.title.includes('[RECONCILED:'));
    assert.ok(c.desc.startsWith('RECONCILED (2026-10-13):'));
  }

  for (const u of findings.undersourced) {
    assert.equal(u.status, 'RESOLVED');
    assert.equal(u.resolved, true);
    assert.ok(u.title.includes('[RECONCILED:'));
    assert.ok(u.desc.startsWith('RECONCILED (2026-10-13):'));
  }
});

test('reconcileNotebookFindings - reconciles CIC-Reddit findings (039e2c13)', () => {
  const redditId = '039e2c13-75b3-4bf2-b58d-9bbce8f73a4d';
  const mockData = {
    trm_intelligence: {
      notebook_findings: {
        [redditId]: {
          contradictions: Array.from({ length: 4 }, (_, i) => ({
            title: `Contradiction ${i + 1}`,
            desc: `Old Reddit C ${i + 1}`,
            status: 'OPEN',
            resolved: false
          })),
          undersourced: Array.from({ length: 5 }, (_, i) => ({
            title: `Undersourced ${i + 1}`,
            desc: `Old Reddit U ${i + 1}`,
            status: 'OPEN',
            resolved: false
          }))
        }
      }
    }
  };

  const changes = reconcileNotebookFindings(mockData);
  assert.equal(changes, 9);

  const findings = mockData.trm_intelligence.notebook_findings[redditId];
  assert.equal(findings.extraction_status, 'RESOLVED (9 Vectors Reconciled)');
  assert.equal(findings.contradictions.length, 4);
  assert.equal(findings.undersourced.length, 5);

  for (const c of findings.contradictions) {
    assert.equal(c.status, 'RESOLVED');
    assert.equal(c.resolved, true);
    assert.ok(c.title.includes('[RECONCILED:'));
    assert.ok(c.desc.startsWith('RECONCILED (2026-10-13):'));
  }

  for (const u of findings.undersourced) {
    assert.equal(u.status, 'RESOLVED');
    assert.equal(u.resolved, true);
    assert.ok(u.title.includes('[RECONCILED:'));
    assert.ok(u.desc.startsWith('RECONCILED (2026-10-13):'));
  }
});

test('reconcileNotebookFindings - reconciles CastIronCharlie-Facebook findings (0c8dc979)', () => {
  const fbId = '0c8dc979-319f-4e6d-8136-22275932c236';
  const mockData = {
    trm_intelligence: {
      notebook_findings: {
        [fbId]: {
          contradictions: Array.from({ length: 4 }, (_, i) => ({
            title: `Contradiction ${i + 1}`,
            desc: `Old FB C ${i + 1}`,
            status: 'OPEN',
            resolved: false
          })),
          undersourced: Array.from({ length: 4 }, (_, i) => ({
            title: `Undersourced ${i + 1}`,
            desc: `Old FB U ${i + 1}`,
            status: 'OPEN',
            resolved: false
          }))
        }
      }
    }
  };

  const changes = reconcileNotebookFindings(mockData);
  assert.equal(changes, 8);

  const findings = mockData.trm_intelligence.notebook_findings[fbId];
  assert.equal(findings.extraction_status, 'RESOLVED (8 Vectors Reconciled)');
  assert.equal(findings.contradictions.length, 4);
  assert.equal(findings.undersourced.length, 4);

  for (const c of findings.contradictions) {
    assert.equal(c.status, 'RESOLVED');
    assert.equal(c.resolved, true);
    assert.ok(c.title.includes('[RECONCILED:'));
    assert.ok(c.desc.startsWith('RECONCILED (2026-10-13):'));
  }

  for (const u of findings.undersourced) {
    assert.equal(u.status, 'RESOLVED');
    assert.equal(u.resolved, true);
    assert.ok(u.title.includes('[RECONCILED:'));
    assert.ok(u.desc.startsWith('RECONCILED (2026-10-13):'));
  }
});

test('reconcileNotebookFindings - reconciles Post-War & Willys-Overland findings (9c469910)', () => {
  const postWarId = '9c469910-a900-43a4-877c-a43c9f545b5f';
  const mockData = {
    trm_intelligence: {
      notebook_findings: {
        [postWarId]: {
          contradictions: Array.from({ length: 2 }, (_, i) => ({
            title: `Contradiction ${i + 1}`,
            desc: `Old PW C ${i + 1}`,
            status: 'OPEN',
            resolved: false
          })),
          undersourced: Array.from({ length: 7 }, (_, i) => ({
            title: `Undersourced ${i + 1}`,
            desc: `Old PW U ${i + 1}`,
            status: 'OPEN',
            resolved: false
          }))
        }
      }
    }
  };

  const changes = reconcileNotebookFindings(mockData);
  assert.equal(changes, 9);

  const findings = mockData.trm_intelligence.notebook_findings[postWarId];
  assert.equal(findings.extraction_status, 'RESOLVED (9 Vectors Reconciled)');
  assert.equal(findings.contradictions.length, 2);
  assert.equal(findings.undersourced.length, 7);

  for (const c of findings.contradictions) {
    assert.equal(c.status, 'RESOLVED');
    assert.equal(c.resolved, true);
    assert.ok(c.title.includes('[RECONCILED:'));
    assert.ok(c.desc.startsWith('RECONCILED (2026-10-13):'));
  }

  for (const u of findings.undersourced) {
    assert.equal(u.status, 'RESOLVED');
    assert.equal(u.resolved, true);
    assert.ok(u.title.includes('[RECONCILED:'));
    assert.ok(u.desc.startsWith('RECONCILED (2026-10-13):'));
  }
});

test('reconcileNotebookFindings - reconciles Willow Run Aviation findings (6fd7c40b)', () => {
  const wrAvId = '6fd7c40b-df90-444b-9c7a-a64682925856';
  const mockData = {
    trm_intelligence: {
      notebook_findings: {
        [wrAvId]: {
          contradictions: Array.from({ length: 3 }, (_, i) => ({
            title: `Contradiction ${i + 1}`,
            desc: `Old WRAv C ${i + 1}`,
            status: 'OPEN',
            resolved: false
          })),
          undersourced: Array.from({ length: 3 }, (_, i) => ({
            title: `Undersourced ${i + 1}`,
            desc: `Old WRAv U ${i + 1}`,
            status: 'OPEN',
            resolved: false
          }))
        }
      }
    }
  };

  const changes = reconcileNotebookFindings(mockData);
  assert.equal(changes, 6);

  const findings = mockData.trm_intelligence.notebook_findings[wrAvId];
  assert.equal(findings.extraction_status, 'RESOLVED (6 Vectors Reconciled)');
  assert.equal(findings.contradictions.length, 3);
  assert.equal(findings.undersourced.length, 3);

  for (const c of findings.contradictions) {
    assert.equal(c.status, 'RESOLVED');
    assert.equal(c.resolved, true);
    assert.ok(c.title.includes('[RECONCILED:'));
    assert.ok(c.desc.startsWith('RECONCILED (2026-10-13):'));
  }

  for (const u of findings.undersourced) {
    assert.equal(u.status, 'RESOLVED');
    assert.equal(u.resolved, true);
    assert.ok(u.title.includes('[RECONCILED:'));
    assert.ok(u.desc.startsWith('RECONCILED (2026-10-13):'));
  }
});

test('reconcileNotebookFindings - reconciles CIC-KB findings (679b8bab)', () => {
  const kbId = '679b8bab-2d87-42cb-a726-6dc54c83acc2';
  const mockData = {
    trm_intelligence: {
      notebook_findings: {
        [kbId]: {
          contradictions: Array.from({ length: 3 }, (_, i) => ({
            title: `Contradiction ${i + 1}`,
            desc: `Old KB C ${i + 1}`,
            status: 'OPEN',
            resolved: false
          })),
          undersourced: Array.from({ length: 2 }, (_, i) => ({
            title: `Undersourced ${i + 1}`,
            desc: `Old KB U ${i + 1}`,
            status: 'OPEN',
            resolved: false
          }))
        }
      }
    }
  };

  const changes = reconcileNotebookFindings(mockData);
  assert.equal(changes, 5);

  const findings = mockData.trm_intelligence.notebook_findings[kbId];
  assert.equal(findings.extraction_status, 'RESOLVED (5 Vectors Reconciled)');
  assert.equal(findings.contradictions.length, 3);
  assert.equal(findings.undersourced.length, 2);

  for (const c of findings.contradictions) {
    assert.equal(c.status, 'RESOLVED');
    assert.equal(c.resolved, true);
    assert.ok(c.title.includes('[RECONCILED:'));
    assert.ok(c.desc.startsWith('RECONCILED (2026-10-13):'));
  }

  for (const u of findings.undersourced) {
    assert.equal(u.status, 'RESOLVED');
    assert.equal(u.resolved, true);
    assert.ok(u.title.includes('[RECONCILED:'));
    assert.ok(u.desc.startsWith('RECONCILED (2026-10-13):'));
  }
});

test('reconcileNotebookFindings - reconciles Agent Harnesses findings (359b346c)', () => {
  const harnessId = '359b346c-6af7-4ba3-baef-b985c9e6e1af';
  const mockData = {
    trm_intelligence: {
      notebook_findings: {
        [harnessId]: {
          contradictions: Array.from({ length: 2 }, (_, i) => ({
            title: `Contradiction ${i + 1}`,
            desc: `Old Harn C ${i + 1}`,
            status: 'OPEN',
            resolved: false
          })),
          undersourced: Array.from({ length: 1 }, (_, i) => ({
            title: `Undersourced ${i + 1}`,
            desc: `Old Harn U ${i + 1}`,
            status: 'OPEN',
            resolved: false
          }))
        }
      }
    }
  };

  const changes = reconcileNotebookFindings(mockData);
  assert.equal(changes, 3);

  const findings = mockData.trm_intelligence.notebook_findings[harnessId];
  assert.equal(findings.extraction_status, 'RESOLVED (3 Vectors Reconciled)');
  assert.equal(findings.contradictions.length, 2);
  assert.equal(findings.undersourced.length, 1);

  for (const c of findings.contradictions) {
    assert.equal(c.status, 'RESOLVED');
    assert.equal(c.resolved, true);
    assert.ok(c.title.includes('[RECONCILED:'));
    assert.ok(c.desc.startsWith('RECONCILED (2026-10-13):'));
  }

  for (const u of findings.undersourced) {
    assert.equal(u.status, 'RESOLVED');
    assert.equal(u.resolved, true);
    assert.ok(u.title.includes('[RECONCILED:'));
    assert.ok(u.desc.startsWith('RECONCILED (2026-10-13):'));
  }
});

test('reconcileNotebookFindings - reconciles IronLedger Architecture findings (76e1932c)', () => {
  const ironId = '76e1932c-054a-4520-9e83-5e882dffc938';
  const mockData = {
    trm_intelligence: {
      notebook_findings: {
        [ironId]: {
          contradictions: Array.from({ length: 3 }, (_, i) => ({
            title: `Contradiction ${i + 1}`,
            desc: `Old Iron C ${i + 1}`,
            status: 'OPEN',
            resolved: false
          })),
          undersourced: Array.from({ length: 2 }, (_, i) => ({
            title: `Undersourced ${i + 1}`,
            desc: `Old Iron U ${i + 1}`,
            status: 'OPEN',
            resolved: false
          }))
        }
      }
    }
  };

  const changes = reconcileNotebookFindings(mockData);
  assert.equal(changes, 5);

  const findings = mockData.trm_intelligence.notebook_findings[ironId];
  assert.equal(findings.extraction_status, 'RESOLVED (5 Vectors Reconciled)');
  assert.equal(findings.contradictions.length, 3);
  assert.equal(findings.undersourced.length, 2);

  for (const c of findings.contradictions) {
    assert.equal(c.status, 'RESOLVED');
    assert.equal(c.resolved, true);
    assert.ok(c.title.includes('[RECONCILED:'));
    assert.ok(c.desc.startsWith('RECONCILED (2026-10-13):'));
  }

  for (const u of findings.undersourced) {
    assert.equal(u.status, 'RESOLVED');
    assert.equal(u.resolved, true);
    assert.ok(u.title.includes('[RECONCILED:'));
    assert.ok(u.desc.startsWith('RECONCILED (2026-10-13):'));
  }
});

test('reconcileNotebookFindings - reconciles Sigil Protocol findings (26eacb85)', () => {
  const sigilId = '26eacb85-2c97-443d-9d81-3bd99cc98412';
  const mockData = {
    trm_intelligence: {
      notebook_findings: {
        [sigilId]: {
          contradictions: Array.from({ length: 3 }, (_, i) => ({
            title: `Contradiction ${i + 1}`,
            desc: `Old Sigil C ${i + 1}`,
            status: 'OPEN',
            resolved: false
          })),
          undersourced: Array.from({ length: 1 }, (_, i) => ({
            title: `Undersourced ${i + 1}`,
            desc: `Old Sigil U ${i + 1}`,
            status: 'OPEN',
            resolved: false
          }))
        }
      }
    }
  };

  const changes = reconcileNotebookFindings(mockData);
  assert.equal(changes, 4);

  const findings = mockData.trm_intelligence.notebook_findings[sigilId];
  assert.equal(findings.extraction_status, 'RESOLVED (4 Vectors Reconciled)');
  assert.equal(findings.contradictions.length, 3);
  assert.equal(findings.undersourced.length, 1);

  for (const c of findings.contradictions) {
    assert.equal(c.status, 'RESOLVED');
    assert.equal(c.resolved, true);
    assert.ok(c.title.includes('[RECONCILED:'));
    assert.ok(c.desc.startsWith('RECONCILED (2026-10-13):'));
  }

  for (const u of findings.undersourced) {
    assert.equal(u.status, 'RESOLVED');
    assert.equal(u.resolved, true);
    assert.ok(u.title.includes('[RECONCILED:'));
    assert.ok(u.desc.startsWith('RECONCILED (2026-10-13):'));
  }
});

test('reconcileNotebookFindings - reconciles 6 single-item notebooks (64949154, 48322e1d, 70be0df3, cb0498ce, 9724e682, 140119ae)', () => {
  const singleIds = [
    '64949154-5892-4fa4-9ad0-e48b2bf5cc6c',
    '48322e1d-d601-4f65-89e0-76282343680d',
    '70be0df3-c58a-4711-b4d3-1e4b8726faf7',
    'cb0498ce-1ea5-4668-9f65-ac368753404e',
    '9724e682-c5ea-4693-8e21-caf8de68611e',
    '140119ae-3496-45c9-bf0c-71c955136afc'
  ];

  const notebookFindings = {};
  for (const id of singleIds) {
    notebookFindings[id] = {
      contradictions: [{ title: 'C1', desc: 'Old C', status: 'OPEN', resolved: false }],
      undersourced: [{ title: 'U1', desc: 'Old U', status: 'OPEN', resolved: false }]
    };
  }

  const mockData = {
    trm_intelligence: {
      notebook_findings: notebookFindings
    }
  };

  const changes = reconcileNotebookFindings(mockData);
  assert.equal(changes, 12);

  for (const id of singleIds) {
    const f = mockData.trm_intelligence.notebook_findings[id];
    assert.equal(f.extraction_status, 'RESOLVED (2 Vectors Reconciled)');
    assert.equal(f.contradictions[0].status, 'RESOLVED');
    assert.equal(f.contradictions[0].resolved, true);
    assert.ok(f.contradictions[0].title.includes('[RECONCILED:'));
    assert.equal(f.undersourced[0].status, 'RESOLVED');
    assert.equal(f.undersourced[0].resolved, true);
    assert.ok(f.undersourced[0].title.includes('[RECONCILED:'));
  }
});

test('markdown registry reconciles Ford Executive Dynamics contradictions and undersourced gaps to [x]', () => {
  const sampleMarkdown = [
    "- [/] [GAP-50] **CIC - Ford Executive Dynamics & Politics (open-contradictions - 1.)**: 1. Origins (Drafted: [RFC](wiki/research/rfc-gap-50.md))",
    "- [/] [GAP-110] **CIC - Ford Executive Dynamics & Politics (under-sourced - 1.)**: 1. Origins (Drafted: [RFC](wiki/research/rfc-gap-110.md))"
  ].join('\n');

  const fordContradictionPattern = /^- \[(?:\/| |x)\]\s+(\[GAP-\d+\]\s+\*\*CIC - Ford Executive Dynamics & Politics \(open-contradictions[^*]+\*\*:[^\n]*?)$/gm;
  let reconciled = sampleMarkdown.replace(fordContradictionPattern, (match, body) => {
    const cleanBody = body.replace(/\s*\((?:Drafted|Resolved):.*?\)\s*$/, '');
    return `- [x] ${cleanBody} (Resolved: [RFC](wiki/research/cic-ford-executive-dynamics-unresolved-contradictions.md))`;
  });

  const fordUndersourcedPattern = /^- \[(?:\/| |x)\]\s+(\[GAP-\d+\]\s+\*\*CIC - Ford Executive Dynamics & Politics \(under-sourced[^*]+\*\*:[^\n]*?)$/gm;
  reconciled = reconciled.replace(fordUndersourcedPattern, (match, body) => {
    const cleanBody = body.replace(/\s*\((?:Drafted|Resolved):.*?\)\s*$/, '');
    return `- [x] ${cleanBody} (Resolved: [RFC](wiki/research/cic-ford-executive-dynamics-undersourced-assertions.md))`;
  });

  assert.ok(reconciled.includes("- [x] [GAP-50] **CIC - Ford Executive Dynamics & Politics (open-contradictions - 1.)**: 1. Origins (Resolved: [RFC](wiki/research/cic-ford-executive-dynamics-unresolved-contradictions.md))"));
  assert.ok(reconciled.includes("- [x] [GAP-110] **CIC - Ford Executive Dynamics & Politics (under-sourced - 1.)**: 1. Origins (Resolved: [RFC](wiki/research/cic-ford-executive-dynamics-undersourced-assertions.md))"));
  assert.ok(!reconciled.includes("(Drafted:"));
});




