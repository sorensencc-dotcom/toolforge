#!/usr/bin/env node
/**
 * Update Focus Areas
 * Reads research-questions.json, emits focus-areas.json:
 * open+escalated questions grouped by source_type, ranked by
 * open-question count (>=2 high, >=1 medium, else low).
 */

import fs from 'fs';
import path from 'path';
import { pathToFileURL } from 'url';

const THEME_LABELS = {
  gap: 'Undocumented events (gap)',
  'low-confidence': 'Low-confidence links',
  'curator-flagged': 'Curator-flagged items'
};

function priorityFromWeight(weight) {
  if (weight >= 2) return 'high';
  if (weight >= 1) return 'medium';
  return 'low';
}

export function computeFocusAreas(researchQuestions) {
  const buckets = {};

  for (const q of researchQuestions.questions) {
    if (q.status !== 'open' && q.status !== 'escalated') continue;

    const theme = THEME_LABELS[q.source_type] || q.source_type;
    if (!buckets[theme]) {
      buckets[theme] = { count: 0 };
    }
    buckets[theme].count++;
  }

  const focus_areas = Object.entries(buckets).map(([theme, { count }]) => ({
    theme,
    open_question_count: count,
    priority: priorityFromWeight(count)
  }));

  return {
    topic: researchQuestions.topic,
    updated: new Date().toISOString(),
    focus_areas
  };
}

// CLI entry point
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const args = process.argv.slice(2);
  const questionsPath = args.find(a => a.startsWith('--questions='))?.split('=')[1];

  if (!questionsPath || !fs.existsSync(questionsPath)) {
    console.error('[ERROR] Missing or invalid --questions path');
    process.exit(1);
  }

  const researchQuestions = JSON.parse(fs.readFileSync(questionsPath, 'utf8'));
  const focusAreas = computeFocusAreas(researchQuestions);

  const outPath = path.join(path.dirname(questionsPath), 'focus-areas.json');
  fs.writeFileSync(outPath, JSON.stringify(focusAreas, null, 2));

  console.log(`[OK] Computed ${focusAreas.focus_areas.length} focus areas`);
  console.log(`[OUTPUT] ${outPath}`);
}
