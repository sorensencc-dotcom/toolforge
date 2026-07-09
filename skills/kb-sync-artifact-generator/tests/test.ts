/**
 * KB Sync Artifact Generator - Test Suite
 */

import { spawn } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

const SKILL_DIR = path.join(__dirname, '..');
const OUTPUT_DIR = path.join(SKILL_DIR, 'test-output');

describe('KB Sync Artifact Generator', () => {
  beforeAll(() => {
    if (!fs.existsSync(OUTPUT_DIR)) {
      fs.mkdirSync(OUTPUT_DIR, { recursive: true });
    }
  });

  test('should generate HTML artifact with required sections', async () => {
    const { execSync } = require('child_process');

    try {
      // Run the skill
      execSync(`cd ${SKILL_DIR} && ts-node src/index.ts`, { encoding: 'utf-8' });

      // Check if HTML was generated
      const htmlPath = path.join('C:\\dev\\cic-os\\personal-knowledge-base', '_integration', 'kb-sync-interactive-report.html');
      expect(fs.existsSync(htmlPath)).toBe(true);

      // Check HTML contains required sections
      const html = fs.readFileSync(htmlPath, 'utf-8');
      expect(html).toContain('KB Sync');
      expect(html).toContain('categoryChart'); // Chart.js canvas
      expect(html).toContain('gridjs'); // Grid.js table
      expect(html).toContain('data-theme'); // Theme toggle
      expect(html).toContain('Broken Links'); // Data section

    } catch (error) {
      console.error('Test failed:', error);
      throw error;
    }
  });

  test('should include Chart.js and Grid.js libraries', async () => {
    const htmlPath = path.join('C:\\dev\\cic-os\\personal-knowledge-base', '_integration', 'kb-sync-interactive-report.html');

    if (fs.existsSync(htmlPath)) {
      const html = fs.readFileSync(htmlPath, 'utf-8');
      expect(html).toContain('chart.js@4.5.0');
      expect(html).toContain('gridjs@5.0.2');
    }
  });

  test('should parse sync and integration reports correctly', async () => {
    const reportPath = path.join('C:\\dev\\cic-os\\personal-knowledge-base', '_integration', 'sync-report.json');

    if (fs.existsSync(reportPath)) {
      const report = JSON.parse(fs.readFileSync(reportPath, 'utf-8'));
      expect(report).toHaveProperty('summary');
      expect(report.summary).toHaveProperty('broken_links');
      expect(report.summary).toHaveProperty('total_pages');
      expect(Array.isArray(report.broken_links)).toBe(true);
    }
  });

  test('should apply CIC design system colors and fonts', async () => {
    const htmlPath = path.join('C:\\dev\\cic-os\\personal-knowledge-base', '_integration', 'kb-sync-interactive-report.html');

    if (fs.existsSync(htmlPath)) {
      const html = fs.readFileSync(htmlPath, 'utf-8');
      expect(html).toContain('Baskerville'); // Body font
      expect(html).toContain('Georgia'); // Heading font
      expect(html).toContain('#8B4513'); // Ember color
      expect(html).toContain('#D4AF37'); // Brass color
      expect(html).toContain('#9B9B8F'); // Sage color
    }
  });

  test('should support dark and light themes', async () => {
    const htmlPath = path.join('C:\\dev\\cic-os\\personal-knowledge-base', '_integration', 'kb-sync-interactive-report.html');

    if (fs.existsSync(htmlPath)) {
      const html = fs.readFileSync(htmlPath, 'utf-8');
      expect(html).toContain('[data-theme="dark"]');
      expect(html).toContain('[data-theme="light"]');
      expect(html).toContain('toggleTheme()');
    }
  });

  test('should include search functionality', async () => {
    const htmlPath = path.join('C:\\dev\\cic-os\\personal-knowledge-base', '_integration', 'kb-sync-interactive-report.html');

    if (fs.existsSync(htmlPath)) {
      const html = fs.readFileSync(htmlPath, 'utf-8');
      expect(html).toContain('searchBox');
      expect(html).toContain('filterTable');
    }
  });
});
