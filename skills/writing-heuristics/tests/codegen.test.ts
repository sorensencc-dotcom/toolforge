import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import { compileCatalog } from '../src/compiler';

describe('Zero-Drift Codegen Invariant', () => {
  it('SKILL.md matches compileCatalog output byte-for-byte', () => {
    const root = path.join(__dirname, '..');
    const catalogPath = path.join(root, 'heuristics.json');
    const skillPath = path.join(root, 'SKILL.md');
    const { skillMd } = compileCatalog(catalogPath);
    const existing = fs.readFileSync(skillPath, 'utf8');
    expect(existing.replace(/\r\n/g, '\n').trim()).toBe(skillMd.replace(/\r\n/g, '\n').trim());
  });

  it('docs/rules.md matches compileCatalog output byte-for-byte', () => {
    const root = path.join(__dirname, '..');
    const catalogPath = path.join(root, 'heuristics.json');
    const rulesPath = path.join(root, 'docs', 'rules.md');
    const { rulesMd } = compileCatalog(catalogPath);
    const existing = fs.readFileSync(rulesPath, 'utf8');
    expect(existing.replace(/\r\n/g, '\n').trim()).toBe(rulesMd.replace(/\r\n/g, '\n').trim());
  });
});
