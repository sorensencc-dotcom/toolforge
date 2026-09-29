import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync, readFileSync, existsSync, readdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  approveStaged,
  decisionId,
  extractFromText,
  parseCard,
  stageExtraction,
  validateDecision,
} from './decision-action-extract.mjs';

const SCRIPT = fileURLToPath(new URL('./decision-action-extract.mjs', import.meta.url));

const VALID = {
  decision_summary: 'Ship typed cards into the git staging buffer',
  owner: 'Chris Sorensen',
  deadline: '2026-10-12',
  verification_gate: 'git diff lists the card and the backlog file is unchanged',
};

function dirs() {
  const root = mkdtempSync(path.join(tmpdir(), 'dec-'));
  return {
    root,
    stagingDir: path.join(root, 'staging'),
    quarantineDir: path.join(root, 'quarantine'),
    backlogDir: path.join(root, 'backlog'),
  };
}

function cleanup(root) {
  rmSync(root, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
}

test('accepts a labeled block and a sprint milestone', () => {
  const text = [
    'Decision: Ship typed cards into the git staging buffer',
    'Owner: Chris Sorensen',
    'Deadline: sprint-35',
    'Verification: git diff lists the card and the backlog file is unchanged',
  ].join('\n');
  const result = extractFromText(text, { source: 'weekly-sync.txt', extractedAt: '2026-09-29T00:00:00.000Z' });
  assert.equal(result.rejected.length, 0);
  assert.equal(result.accepted.length, 1);
  assert.equal(result.accepted[0].deadline, 'Sprint 35');
  assert.equal(result.accepted[0].owner, 'Chris Sorensen');
  assert.equal(result.accepted[0].status, 'STAGED_FOR_REVIEW');
  assert.equal(result.accepted[0].id, decisionId(result.accepted[0]));
});

test('rejects soon, a shared owner, and an impossible calendar date', () => {
  const soon = validateDecision({ ...VALID, deadline: 'soon' });
  assert.equal(soon.ok, false);
  assert.match(soon.errors.join('\n'), /soon/);

  const shared = validateDecision({ ...VALID, owner: 'Alex and Jordan' });
  assert.equal(shared.ok, false);
  assert.match(shared.errors.join('\n'), /single accountable person/);

  const slash = validateDecision({ ...VALID, owner: 'Alex/Jordan' });
  assert.equal(slash.ok, false);

  const impossible = validateDecision({ ...VALID, deadline: '2026-02-31' });
  assert.equal(impossible.ok, false);
  assert.match(impossible.errors.join('\n'), /2026-02-31/);
});

test('does not invent an owner from unlabeled prose', () => {
  const text = [
    'Chris said we should probably do this soon.',
    'Alex and Jordan will handle the follow-up.',
  ].join('\n');
  const result = extractFromText(text, { source: 'chatter.txt' });
  assert.equal(result.accepted.length, 0);
  assert.deepEqual(result.rejected[0].errors, ['no labeled decision blocks in transcript']);
});

test('reads a Google Meet timestamp and a pipe row', () => {
  const meet = [
    '00:14:02 Chris Sorensen: Decision: Ship typed cards into the git staging buffer',
    '00:14:10 Chris Sorensen: Owner: José Muñoz',
    '00:14:18 Chris Sorensen: Deadline: 2026-10-12T15:30:00Z',
    '00:14:30 Chris Sorensen: Verification: git diff lists the card and the test exits 0',
    '',
    '- Publish the decision log for the redesign sync | trm-bot | Sprint 36 | test file exists and exits 0',
  ].join('\n');
  const result = extractFromText(meet, { source: 'meet.txt' });
  assert.equal(result.rejected.length, 0);
  assert.equal(result.accepted.length, 2);
  assert.equal(result.accepted[0].owner, 'José Muñoz');
  assert.equal(result.accepted[0].deadline, '2026-10-12T15:30:00Z');
  assert.equal(result.accepted[1].owner, 'trm-bot');
  assert.equal(result.accepted[1].deadline, 'Sprint 36');
});

test('validates JSON proposals and drops non-string owners', () => {
  const payload = {
    decisions: [
      VALID,
      { ...VALID, owner: ['Alex', 'Jordan'], decision_summary: 'Assign the follow-up to two people' },
    ],
  };
  const result = extractFromText(JSON.stringify(payload), { source: 'model.json' });
  assert.equal(result.accepted.length, 1);
  assert.equal(result.rejected.length, 1);
  assert.match(result.rejected[0].errors.join('\n'), /owner must be a single string/);
});

test('stages accepted cards and quarantines soon without writing the backlog', () => {
  const layout = dirs();
  try {
    const text = [
      'Decision: Ship typed cards into the git staging buffer',
      'Owner: Chris Sorensen',
      'Deadline: 2026-10-12',
      'Verification: git diff lists the card and the backlog file is unchanged',
      '',
      'Decision: Circle back on the intake notes',
      'Owner: Alex',
      'Deadline: soon',
      'Gate: done',
    ].join('\n');
    const result = stageExtraction(text, {
      source: 'weekly-sync.txt',
      extractedAt: '2026-09-29T00:00:00.000Z',
      stagingDir: layout.stagingDir,
      quarantineDir: layout.quarantineDir,
    });
    assert.equal(result.accepted.length, 1);
    assert.equal(result.rejected.length, 1);
    assert.equal(existsSync(layout.backlogDir), false);
    const card = parseCard(readFileSync(result.stagedPaths[0], 'utf8'));
    assert.equal(card.status, 'STAGED_FOR_REVIEW');
    assert.equal(card.owner, 'Chris Sorensen');
    const quarantine = JSON.parse(readFileSync(result.quarantinedPaths[0], 'utf8'));
    assert.match(quarantine.errors.join('\n'), /soon/);
    assert.match(quarantine.errors.join('\n'), /observable/);
  } finally {
    cleanup(layout.root);
  }
});

test('approve copies a reviewed card into the backlog and leaves a tampered card staged', () => {
  const layout = dirs();
  try {
    const staged = stageExtraction(
      [
        'Decision: Ship typed cards into the git staging buffer',
        'Owner: Chris Sorensen',
        'Deadline: 2026-10-12',
        'Verification: git diff lists the card and the backlog file is unchanged',
      ].join('\n'),
      {
        source: 'weekly-sync.txt',
        extractedAt: '2026-09-29T00:00:00.000Z',
        stagingDir: layout.stagingDir,
        quarantineDir: layout.quarantineDir,
      },
    );
    const id = staged.accepted[0].id;
    const approved = approveStaged(id, {
      stagingDir: layout.stagingDir,
      backlogDir: layout.backlogDir,
      approvedAt: '2026-09-29T01:00:00.000Z',
    });
    assert.equal(approved.ok, true);
    assert.equal(existsSync(path.join(layout.stagingDir, `${id}.md`)), false);
    const card = parseCard(readFileSync(approved.backlogPath, 'utf8'));
    assert.equal(card.status, 'APPROVED');
    assert.equal(card.approved_at, '2026-09-29T01:00:00.000Z');

    const again = stageExtraction(
      [
        'Decision: Ship typed cards into the git staging buffer',
        'Owner: Chris Sorensen',
        'Deadline: 2026-10-12',
        'Verification: git diff lists the card and the backlog file is unchanged',
      ].join('\n'),
      {
        source: 'weekly-sync.txt',
        extractedAt: '2026-09-29T00:00:00.000Z',
        stagingDir: layout.stagingDir,
        quarantineDir: layout.quarantineDir,
      },
    );
    const tamperedPath = again.stagedPaths[0];
    const tampered = readFileSync(tamperedPath, 'utf8').replaceAll(
      'Ship typed cards into the git staging buffer',
      'Ship something else entirely now',
    );
    writeFileSync(tamperedPath, tampered, 'utf8');
    const refused = approveStaged(id, {
      stagingDir: layout.stagingDir,
      backlogDir: layout.backlogDir,
      approvedAt: '2026-09-29T02:00:00.000Z',
    });
    assert.equal(refused.ok, false);
    assert.match(refused.error, /does not match/);
    assert.equal(existsSync(tamperedPath), true);
    assert.equal(readdirSync(layout.backlogDir).length, 1);
  } finally {
    cleanup(layout.root);
  }
});

test('the CLI stages a transcript, exits 2 on rejection, and approves without committing', () => {
  const layout = dirs();
  try {
    const transcript = path.join(layout.root, 'sync.txt');
    writeFileSync(transcript, [
      '**Decision:** Ship typed cards into the git staging buffer',
      '**Owner:** Chris Sorensen',
      '**Deadline:** 2026-10-12',
      '**Done when:** git diff lists the card and the backlog file is unchanged',
      '',
      'Decision: Ping the channel',
      'Owner: the team',
      'Deadline: ASAP',
      'Verification: git status shows a file',
    ].join('\n'), 'utf8');

    const extracted = spawnSync('node', [
      SCRIPT,
      `--input=${transcript}`,
      '--source=sync.txt',
      `--staging=${layout.stagingDir}`,
      `--quarantine=${layout.quarantineDir}`,
      `--backlog=${layout.backlogDir}`,
    ], { encoding: 'utf8' });
    assert.equal(extracted.status, 2, extracted.stdout + extracted.stderr);
    assert.match(extracted.stdout, /staged 1/);
    assert.match(extracted.stdout, /rejected 1/);
    assert.match(extracted.stdout, /does not commit/);
    assert.equal(existsSync(layout.backlogDir), false);

    const id = readdirSync(layout.stagingDir)[0].replace(/\.md$/, '');
    const approved = spawnSync('node', [
      SCRIPT,
      `--approve=${id}`,
      `--staging=${layout.stagingDir}`,
      `--backlog=${layout.backlogDir}`,
    ], { encoding: 'utf8' });
    assert.equal(approved.status, 0, approved.stdout + approved.stderr);
    assert.match(approved.stdout, /does not commit/);
    assert.equal(existsSync(path.join(layout.backlogDir, `${id}.md`)), true);
    assert.equal(readdirSync(layout.stagingDir).length, 0);
  } finally {
    cleanup(layout.root);
  }
});
