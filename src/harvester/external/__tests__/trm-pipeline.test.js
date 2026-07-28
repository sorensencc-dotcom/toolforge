import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { processDecisions, buildIngestManifest } from '../curator-decision-processor.mjs';
import { scanGaps } from '../scan-gaps.mjs';
import { computeFocusAreas } from '../update-focus-areas.mjs';

const sampleDecisions = {
  batch_id: 'willow-run-b001',
  attribution: {
    source: 'Benson Ford Research Center',
    credit_requirement: '© Benson Ford Research Center',
  },
  verification_notes: {
    attribution_required: '© Benson Ford Research Center',
  },
  decisions: [
    {
      photo_id: 'P-101',
      decision: 'link-to-fact',
      topics: ['B-24 Assembly', 'Willow Run'],
      confidence: 0.95,
      verified: true,
      flagged_for_research: false,
    },
    {
      photo_id: 'P-102',
      decision: 'link-to-fact',
      topics: ['Riveting', 'Rosie the Riveter'],
      confidence: 0.65,
      verified: false,
      flagged_for_research: false,
    },
    {
      photo_id: 'P-103',
      decision: 'new-fact',
      topics: ['Sub-assembly Line 4'],
      confidence: 0.70,
      verified: true,
      flagged_for_research: false,
    },
    {
      photo_id: 'P-104',
      decision: 'link-to-fact',
      topics: ['Inspection Hangar'],
      confidence: 0.85,
      verified: true,
      flagged_for_research: true,
    },
    {
      photo_id: 'P-105',
      decision: 'reject',
      topics: ['Unrelated Field'],
      confidence: 0.20,
      verified: false,
      flagged_for_research: false,
    },
  ],
};

test('TRM Pipeline End-to-End & Contract Integrity', async (t) => {
  await t.test('TRM pipeline preserves approved, rejected, and candidate decisions', () => {
    const topic = 'willow-run-b24';
    const processed = processDecisions(sampleDecisions);
    const manifest = buildIngestManifest(sampleDecisions, processed);
    const questionsObj = scanGaps(sampleDecisions, topic);
    const focusAreasObj = computeFocusAreas(questionsObj);

    // Summary counts
    assert.equal(manifest.summary.approved_for_ingest, 3);
    assert.equal(manifest.summary.new_fact_candidates, 1);
    assert.equal(manifest.summary.rejected, 1);

    // Question ID and Origin Hash format assertions
    assert.ok(questionsObj.questions.every((q) => q.id.startsWith('q-')));
    assert.ok(questionsObj.questions.every((q) => /^sha256:[a-f0-9]{64}$/.test(q.question_origin_hash)));
    assert.ok(questionsObj.questions.every((q) => /^sha256:[a-f0-9]{64}$/.test(q.deterministic_id)));

    // Open question count parity
    const openQuestionCount = questionsObj.questions.filter((q) => q.status === 'open').length;
    const focusAreaQuestionCount = focusAreasObj.focus_areas.reduce((n, area) => n + area.open_question_count, 0);
    assert.equal(openQuestionCount, focusAreaQuestionCount);
  });

  await t.test('Empty and malformed input handling', () => {
    const emptyDecisions = { batch_id: 'empty-b1', decisions: [] };
    const processed = processDecisions(emptyDecisions);
    assert.equal(processed.total_processed, 0);
    assert.equal(processed.approved_links.length, 0);

    const manifest = buildIngestManifest(emptyDecisions, processed);
    assert.equal(manifest.summary.approved_for_ingest, 0);
    assert.equal(manifest.summary.new_fact_candidates, 0);
    assert.equal(manifest.summary.rejected, 0);

    const draft = scanGaps(emptyDecisions, 'empty-topic');
    assert.equal(draft.questions.length, 0);

    const focus = computeFocusAreas({ topic: 'empty-topic', questions: [] });
    assert.equal(focus.focus_areas.length, 0);
  });

  await t.test('Boundary confidence values: 0, 0.79, 0.80, 1.0', () => {
    const boundaryDecisions = {
      batch_id: 'boundary-b1',
      decisions: [
        { photo_id: 'P-ZERO', decision: 'link-to-fact', topics: ['T1'], confidence: 0.0, verified: false },
        { photo_id: 'P-79', decision: 'link-to-fact', topics: ['T2'], confidence: 0.79, verified: false },
        { photo_id: 'P-80', decision: 'link-to-fact', topics: ['T3'], confidence: 0.80, verified: true },
        { photo_id: 'P-ONE', decision: 'link-to-fact', topics: ['T4'], confidence: 1.0, verified: true },
      ],
    };

    const processed = processDecisions(boundaryDecisions);
    const manifest = buildIngestManifest(boundaryDecisions, processed);

    const pZero = manifest.approved_photos.find((p) => p.photo_id === 'P-ZERO');
    assert.equal(pZero.priority, 'MEDIUM');

    const p79 = manifest.approved_photos.find((p) => p.photo_id === 'P-79');
    assert.equal(p79.priority, 'MEDIUM');

    const p80 = manifest.approved_photos.find((p) => p.photo_id === 'P-80');
    assert.equal(p80.priority, 'HIGH', '0.80 boundary confidence must yield HIGH priority');

    const pOne = manifest.approved_photos.find((p) => p.photo_id === 'P-ONE');
    assert.equal(pOne.priority, 'HIGH', '1.0 confidence must yield HIGH priority');

    const draft = scanGaps(boundaryDecisions, 'boundary-test');
    assert.equal(draft.questions.length, 2);
    const factIds = draft.questions.map((q) => q.fact_id);
    assert.deepEqual(factIds, ['P-ZERO', 'P-79']);
  });

  await t.test('Missing optional fields (topics, confidence, flagged_for_research)', () => {
    const minimalDecisions = {
      batch_id: 'min-b1',
      decisions: [
        { photo_id: 'P-MIN-1', decision: 'link-to-fact' },
        { photo_id: 'P-MIN-2', decision: 'new-fact' },
      ],
    };

    const processed = processDecisions(minimalDecisions);
    assert.equal(processed.total_processed, 2);
    assert.deepEqual(processed.approved_links[0].trm_topics, undefined);

    const draft = scanGaps(minimalDecisions, 'min-test');
    assert.equal(draft.questions.length, 1, 'new-fact should create gap question even without optional fields');
    assert.equal(draft.questions[0].source_type, 'gap');
  });

  await t.test('Determinism across two identical runs', () => {
    const topic = 'deterministic-topic';
    const run1_questions = scanGaps(sampleDecisions, topic);
    const run2_questions = scanGaps(sampleDecisions, topic);

    assert.equal(run1_questions.questions.length, run2_questions.questions.length);

    for (let i = 0; i < run1_questions.questions.length; i++) {
      const q1 = run1_questions.questions[i];
      const q2 = run2_questions.questions[i];
      assert.equal(q1.deterministic_id, q2.deterministic_id);
      assert.equal(q1.question_origin_hash, q2.question_origin_hash);
      assert.equal(q1.id, q2.id);
      assert.equal(q1.question, q2.question);
    }
  });

  await t.test('Ignoring already-resolved questions in computeFocusAreas', () => {
    const inputQuestions = {
      topic: 'resolved-test',
      questions: [
        { id: 'q-0001', source_type: 'gap', status: 'open' },
        { id: 'q-0002', source_type: 'gap', status: 'resolved' },
        { id: 'q-0003', source_type: 'gap', status: 'closed' },
        { id: 'q-0004', source_type: 'low-confidence', status: 'escalated' },
      ],
    };

    const focus = computeFocusAreas(inputQuestions);
    const gapFocus = focus.focus_areas.find((f) => f.theme === 'Undocumented events (gap)');
    assert.equal(gapFocus.open_question_count, 1, 'Only open and escalated questions should be counted');

    const lowConfFocus = focus.focus_areas.find((f) => f.theme === 'Low-confidence links');
    assert.equal(lowConfFocus.open_question_count, 1);
  });

  await t.test('Strict Schema validation of every emitted object', () => {
    const processed = processDecisions(sampleDecisions);
    const manifest = buildIngestManifest(sampleDecisions, processed);
    const draft = scanGaps(sampleDecisions, 'schema-val');
    const focus = computeFocusAreas(draft);

    // Manifest schema
    assert.equal(typeof manifest.batch_id, 'string');
    assert.equal(typeof manifest.curator_review_complete, 'boolean');
    assert.equal(typeof manifest.summary.approved_for_ingest, 'number');
    assert.ok(Array.isArray(manifest.approved_photos));
    assert.ok(Array.isArray(manifest.new_fact_candidates));
    assert.ok(Array.isArray(manifest.rejected_photos));

    for (const photo of manifest.approved_photos) {
      assert.equal(typeof photo.photo_id, 'string');
      assert.ok(['HIGH', 'MEDIUM', 'LOW'].includes(photo.priority));
      assert.equal(typeof photo.action, 'string');
      assert.equal(typeof photo.status, 'string');
    }

    // Questions schema
    for (const q of draft.questions) {
      assert.equal(typeof q.id, 'string');
      assert.equal(typeof q.deterministic_id, 'string');
      assert.equal(typeof q.source_type, 'string');
      assert.equal(typeof q.fact_id, 'string');
      assert.equal(typeof q.question, 'string');
      assert.equal(typeof q.question_origin_hash, 'string');
      assert.equal(typeof q.status, 'string');
    }

    // Focus areas schema
    for (const fa of focus.focus_areas) {
      assert.equal(typeof fa.theme, 'string');
      assert.equal(typeof fa.open_question_count, 'number');
      assert.ok(['high', 'medium', 'low'].includes(fa.priority));
    }
  });

  await t.test('Persisted JSON contract test (Disk I/O to temporary directory)', () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'trm-test-'));
    try {
      const processed = processDecisions(sampleDecisions);
      const manifest = buildIngestManifest(sampleDecisions, processed);
      const draft = scanGaps(sampleDecisions, 'disk-test');
      const focus = computeFocusAreas(draft);

      const manifestPath = path.join(tmpDir, 'trm-ingest-manifest.json');
      const draftPath = path.join(tmpDir, 'draft-questions.json');
      const focusPath = path.join(tmpDir, 'focus-areas.json');

      fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
      fs.writeFileSync(draftPath, JSON.stringify(draft, null, 2));
      fs.writeFileSync(focusPath, JSON.stringify(focus, null, 2));

      // Read back and verify persisted JSON contracts
      const loadedManifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
      const loadedDraft = JSON.parse(fs.readFileSync(draftPath, 'utf8'));
      const loadedFocus = JSON.parse(fs.readFileSync(focusPath, 'utf8'));

      assert.deepEqual(loadedManifest.summary, manifest.summary);
      assert.equal(loadedDraft.questions.length, draft.questions.length);
      assert.equal(loadedFocus.focus_areas.length, focus.focus_areas.length);
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });
});
