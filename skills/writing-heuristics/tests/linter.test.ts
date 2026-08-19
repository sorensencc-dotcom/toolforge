import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import { lintText } from '../src/linter';

describe('Linter 11-Rule Suite', () => {
  const fixturesDir = path.join(__dirname, 'fixtures');

  it('passes on pass-all.md fixture', () => {
    const content = fs.readFileSync(path.join(fixturesDir, 'pass-all.md'), 'utf8');
    const res = lintText(content);
    expect(res.clean).toBe(true);
    expect(res.errorCount).toBe(0);
    expect(res.warningCount).toBe(0);
  });

  it('detects violations on fail-rules.md fixture', () => {
    const content = fs.readFileSync(path.join(fixturesDir, 'fail-rules.md'), 'utf8');
    const res = lintText(content);
    expect(res.clean).toBe(false);
    expect(res.violations.some((v) => v.ruleId === 'ban-throat-clearing')).toBe(true);
    expect(res.violations.some((v) => v.ruleId === 'ban-filler-adverbs')).toBe(true);
    expect(res.violations.some((v) => v.ruleId === 'avoid-first-person-plural')).toBe(true);
    expect(res.violations.some((v) => v.ruleId === 'use-second-person')).toBe(true);
    expect(res.violations.some((v) => v.ruleId === 'active-voice')).toBe(true);
    expect(res.violations.some((v) => v.ruleId === 'assertion-density')).toBe(true);
    expect(res.violations.some((v) => v.ruleId === 'condition-before-action')).toBe(true);
    expect(res.violations.some((v) => v.ruleId === 'heading-sentence-case')).toBe(true);
    expect(res.violations.some((v) => v.ruleId === 'descriptive-links')).toBe(true);
    expect(res.violations.some((v) => v.ruleId === 'serial-comma')).toBe(true);
  });

  it('respects inline suppression directives', () => {
    const content = fs.readFileSync(path.join(fixturesDir, 'suppressed.md'), 'utf8');
    const res = lintText(content);
    expect(res.violations.filter((v) => v.ruleId === 'ban-filler-adverbs').length).toBe(0);
  });
});
