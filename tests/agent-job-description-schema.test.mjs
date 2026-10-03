import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

function validateAgentJobDescription(payload, schema) {
  const errors = [];

  if (payload.schemaVersion !== '1.0.0') {
    errors.push('Unsupported or missing schemaVersion: must be 1.0.0');
  }

  const requiredRootFields = [
    'schemaVersion',
    'roleId',
    'title',
    'version',
    'tier',
    'domain',
    'description',
    'responsibilities',
    'capabilities',
    'governance'
  ];

  for (const field of requiredRootFields) {
    if (payload[field] === undefined || payload[field] === null) {
      errors.push(`Missing required root field: ${field}`);
    }
  }

  if (payload.roleId && !/^[a-z0-9-_]+$/.test(payload.roleId)) {
    errors.push('Invalid roleId format: must match ^[a-z0-9-_]+$');
  }

  const validTiers = [
    'Tier 1 (Decision)',
    'Tier 2 (Execution)',
    'Tier 3 (Automation)',
    'Tier 1',
    'Tier 2',
    'Tier 3'
  ];
  if (payload.tier && !validTiers.includes(payload.tier)) {
    errors.push(`Invalid tier: ${payload.tier}`);
  }

  if (payload.responsibilities && (!Array.isArray(payload.responsibilities) || payload.responsibilities.length === 0)) {
    errors.push('responsibilities must be a non-empty array of strings');
  }

  if (payload.capabilities) {
    if (!payload.capabilities.skills || !Array.isArray(payload.capabilities.skills.allowed)) {
      errors.push('capabilities.skills.allowed must be an array');
    }
    if (!payload.capabilities.permissions || !payload.capabilities.permissions.filesystem) {
      errors.push('capabilities.permissions.filesystem is required');
    } else {
      const validFs = ['deny', 'read-only', 'workspace-write', 'full-write'];
      if (!validFs.includes(payload.capabilities.permissions.filesystem)) {
        errors.push(`Invalid filesystem permission mode: ${payload.capabilities.permissions.filesystem}`);
      }
    }
  }

  if (payload.governance) {
    if (!Array.isArray(payload.governance.acceptanceCriteria) || payload.governance.acceptanceCriteria.length === 0) {
      errors.push('governance.acceptanceCriteria must be a non-empty array');
    }
  }

  return { valid: errors.length === 0, errors };
}

describe('Agent Job Description Schema Test Suite', () => {
  const schemaPath = path.resolve('schemas/agent-job-description-schema.json');

  it('verifies schema file presence and JSON validity', () => {
    assert.ok(fs.existsSync(schemaPath), 'Schema file must exist on disk');
    const schema = JSON.parse(fs.readFileSync(schemaPath, 'utf8'));
    assert.equal(schema.title, 'AgentJobDescription');
    assert.equal(schema.$id, 'https://toolforge.rewrite.internal/schemas/v1/agent-job-description.json');
    assert.ok(schema.required.includes('roleId'));
    assert.ok(schema.required.includes('tier'));
    assert.ok(schema.required.includes('governance'));
  });

  it('validates a complete, compliant Agent Job Description', () => {
    const compliantAjd = {
      schemaVersion: '1.0.0',
      roleId: 'trm-research-worker',
      title: 'TRM Autonomous Research Worker',
      version: '1.0.0',
      tier: 'Tier 2 (Execution)',
      domain: 'toolforge',
      description: 'Executes closed-loop TRM research mining, gap triage, and synthesis.',
      responsibilities: [
        'Poll TRM mobile ingress inboxes for new action items',
        'Extract deterministic entities and score research candidates',
        'Stage validated tasks to .harness/tasks/pending/'
      ],
      capabilities: {
        skills: {
          allowed: ['trm-closed-loop-research', 'trm-gap-triage', 'trm-devops-triage'],
          required: ['trm-closed-loop-research']
        },
        mcpServers: ['kb-context-cache', 'ijfw-memory'],
        toolGroups: {
          allowWriteTools: true,
          allowSubagentTools: false,
          allowMcpTools: true,
          allowBrowserTools: false
        },
        permissions: {
          filesystem: 'workspace-write',
          allowedPaths: ['wiki/research', 'trm-drive/inbox', '.harness/tasks'],
          network: {
            mode: 'allowlisted',
            bounds: ['api.github.com']
          },
          process: 'allow-child'
        }
      },
      routing: {
        preferredModel: 'gemini-2.5-pro',
        allowedModels: ['claude-3-5-sonnet', 'gpt-4o'],
        maxCostUsdPerTask: 0.50,
        maxExecutionTimeSec: 600,
        maxAttempts: 3
      },
      governance: {
        acceptanceCriteria: [
          'All research outputs adhere to TRM entity JSON schemas',
          'No ungrounded assertions present in generated RFC notes',
          'Receipt generated in trm-drive/inbox/outbox/'
        ],
        verificationCommands: [
          'npm run test:trm',
          'npm run trm:kisp:validate'
        ],
        driftGuard: {
          enabled: true,
          metrics: ['entity_coverage', 'token_efficiency'],
          maxAllowedDriftPercent: 5.0
        }
      },
      metadata: {
        author: 'sorensencc-dotcom',
        createdAt: '2026-10-03T12:55:02Z',
        trackingIssue: 'https://github.com/sorensencc-dotcom/toolforge/issues/75'
      }
    };

    const result = validateAgentJobDescription(compliantAjd);
    assert.ok(result.valid, `Expected valid AJD, got errors: ${result.errors.join(', ')}`);
  });

  it('rejects an AJD missing required fields', () => {
    const invalidAjd = {
      schemaVersion: '1.0.0',
      title: 'Incomplete Role'
    };

    const result = validateAgentJobDescription(invalidAjd);
    assert.equal(result.valid, false);
    assert.ok(result.errors.some(e => e.includes('Missing required root field: roleId')));
    assert.ok(result.errors.some(e => e.includes('Missing required root field: tier')));
  });

  it('rejects an invalid authority tier', () => {
    const invalidTierAjd = {
      schemaVersion: '1.0.0',
      roleId: 'rogue-agent',
      title: 'Rogue Agent',
      version: '1.0.0',
      tier: 'Tier 99 (Unconstrained)',
      domain: 'toolforge',
      description: 'Agent with illegal authority tier',
      responsibilities: ['Do anything'],
      capabilities: {
        skills: { allowed: ['*'] },
        permissions: { filesystem: 'workspace-write' }
      },
      governance: {
        acceptanceCriteria: ['Must finish']
      }
    };

    const result = validateAgentJobDescription(invalidTierAjd);
    assert.equal(result.valid, false);
    assert.ok(result.errors.some(e => e.includes('Invalid tier')));
  });

  it('rejects an invalid filesystem permission mode', () => {
    const invalidFsAjd = {
      schemaVersion: '1.0.0',
      roleId: 'test-agent',
      title: 'Test Agent',
      version: '1.0.0',
      tier: 'Tier 3',
      domain: 'toolforge',
      description: 'Test agent with illegal filesystem permission',
      responsibilities: ['Execute batch scripts'],
      capabilities: {
        skills: { allowed: [] },
        permissions: { filesystem: 'arbitrary-root-access' }
      },
      governance: {
        acceptanceCriteria: ['Verification passes']
      }
    };

    const result = validateAgentJobDescription(invalidFsAjd);
    assert.equal(result.valid, false);
    assert.ok(result.errors.some(e => e.includes('Invalid filesystem permission mode')));
  });
});
