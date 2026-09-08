#!/usr/bin/env node
// ==============================================================================
// YouTube Script Claim Linter (Pre-Recording Historical QA)
// Scans draft video voiceover scripts against canonical research facts in wiki/research/
// to prevent ungrounded claims, historical errors, and debunked folklore from reaching production.
// ==============================================================================

import fs from 'node:fs';
import path from 'node:path';

const COLOR = {
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
  bold: '\x1b[1m',
  reset: '\x1b[0m',
};

/**
 * Historical Claim Rule Definition
 * @typedef {Object} ClaimRule
 * @property {string} id - Rule identifier
 * @property {string} description - What this rule verifies
 * @property {RegExp} pattern - Regex triggering the violation
 * @property {RegExp} [exemption] - Context pattern that excuses the mention (e.g. debunking context)
 * @property {string} severity - 'error' | 'warning'
 * @property {string} correction - Guidance on how to correct the text
 * @property {string} canonicalNote - File path to the canonical research note
 */

export const RULES = [
  {
    id: 'HIST-01-B17-WILLOW-RUN',
    description: 'Willow Run produced B-24 Liberators only, never Boeing B-17 Flying Fortresses.',
    pattern: /(?:built|manufactured|produced|delivered|assembled)\s+(?:(?:\d[\d,]*\s+)?(?:Boeing\s+)?B-17[s\w]*|B-17\s+Flying\s+Fortress(?:es)?)\s+(?:at|from|by)\s+Willow\s+Run/i,
    exemption: /(?:never|zero|0|debunk|false|myth|erroneous|exclusive|misconception|didn't|did\s+not|BVD\s+pool)/i,
    severity: 'error',
    correction: 'Willow Run manufactured 8,685 Consolidated B-24 Liberators (6,792 complete + 1,893 kits) and 0 B-17s. B-17s were built by the Boeing-Vega-Douglas (BVD) consortium.',
    canonicalNote: 'wiki/research/rfc-gap-03--willow-run-videos-under-sourc.md'
  },
  {
    id: 'HIST-02-B17-COUNT-MISMATCH',
    description: 'Ford did not build 6,791 B-17s.',
    pattern: /6[,.]?79[12]\s+(?:Boeing\s+)?B-17/i,
    exemption: /(?:myth|error|false|debunk|incorrectly|transposed)/i,
    severity: 'error',
    correction: '6,792 was the number of completed B-24 Liberator flyaways built at Willow Run, not B-17s.',
    canonicalNote: 'wiki/research/rfc-gap-03--willow-run-videos-under-sourc.md'
  },
  {
    id: 'HIST-03-ALUMINUM-COFFIN-MYTH',
    description: 'Melted aluminum coffins were never used for B-24 structural airframe skins.',
    pattern: /(?:melted|used|purchased|bought)\s+(?:thousands\s+of\s+)?(?:aluminum|aluminium)\s+coffins?\s+(?:to\s+(?:build|make|keep|stamp)|for\s+(?:bomber|aircraft|B-24)\s+skins?)/i,
    exemption: /(?:myth|legend|apocryphal|folklore|debunk|impossible|unfit|failed|could\s+not|unsuitable)/i,
    severity: 'error',
    correction: 'Scrap mortuary aluminum could not meet USAAF Alclad 24S-T structural tensile standards. Frame this story as an apocryphal wartime myth born out of WPB Limitation Order L-64.',
    canonicalNote: 'wiki/research/rfc-gap-09-aluminum-coffin-scrap-legend.md'
  },
  {
    id: 'HIST-04-L-BEND-TAX-DODGE',
    description: 'The Willow Run L-bend was dictated by airfield runway clearance, not Wayne County tax evasion.',
    pattern: /(?:bent|turned|L-bend|90-degree\s+turn)\s+.*(?:to\s+(?:avoid|dodge|escape)\s+(?:Wayne\s+County\s+)?taxes|tax\s+evasion|avoid\s+union\s+taxes)/i,
    exemption: /(?:myth|legend|folklore|debunk|contrary|actually|instead|in\s+reality|runway\s+approach|glide\s+slope)/i,
    severity: 'error',
    correction: 'Albert Kahn blueprints confirm the 90-degree turn was required to avoid penetrating the 50:1 glide slope of Runway 09L/27R. The Defense Plant Corporation owned the facility as a tax-exempt asset.',
    canonicalNote: 'wiki/research/willow-run-l-bend-tax-legend.md'
  },
  {
    id: 'HIST-05-B24-OUTPUT-PRECISION',
    description: 'Ensure accurate total production numbers for Willow Run B-24 output.',
    pattern: /Willow\s+Run\s+produced\s+(?:only\s+)?(?:1[,.]?89[34]|4[,.]?\d{3})\s+B-24/i,
    exemption: /(?:kits|knock-?down|flyaway|complete|plus|and)/i,
    severity: 'warning',
    correction: 'Willow Run produced 8,685 total B-24s (6,792 completed bombers + 1,893 knockdown kits).',
    canonicalNote: 'wiki/research/rfc-gap-06-willow-run-b-24-knock-down-kit.md'
  }
];

/**
 * Lints script content against historical QA rules.
 * @param {string} content - Script text to analyze
 * @param {string} [filename='input'] - Name of file being checked
 * @returns {{ errors: Array, warnings: Array, pass: boolean }}
 */
export function lintScriptContent(content, filename = 'input') {
  const errors = [];
  const warnings = [];
  const lines = content.split(/\r?\n/);

  for (let lineNum = 1; lineNum <= lines.length; lineNum++) {
    const line = lines[lineNum - 1];
    
    for (const rule of RULES) {
      if (rule.pattern.test(line)) {
        // Check if exemption context exists on this line or neighboring lines
        const contextWindow = lines.slice(Math.max(0, lineNum - 3), Math.min(lines.length, lineNum + 2)).join(' ');
        if (rule.exemption && rule.exemption.test(contextWindow)) {
          continue; // Exempted by debunking or qualifying context
        }

        const violation = {
          ruleId: rule.id,
          line: lineNum,
          content: line.trim(),
          description: rule.description,
          correction: rule.correction,
          canonicalNote: rule.canonicalNote,
          filename,
        };

        if (rule.severity === 'error') {
          errors.push(violation);
        } else {
          warnings.push(violation);
        }
      }
    }
  }

  return {
    errors,
    warnings,
    pass: errors.length === 0,
  };
}

/**
 * Self-test suite for script linter.
 */
function runSelfTests() {
  console.log(`${COLOR.bold}[SCRIPT-LINTER] Running self-test suite...${COLOR.reset}`);
  
  const badScript = `
    In 1943, Ford built 6,791 B-17 Flying Fortresses at Willow Run.
    When aluminum was scarce, Ford melted aluminum coffins to make bomber skins.
    Henry Ford bent the factory to avoid Wayne County taxes.
  `;

  const goodScript = `
    Willow Run was tooled exclusively for the Consolidated B-24 Liberator, delivering 8,685 units (6,792 completed and 1,893 knockdown kits). Zero B-17s were built at the plant.
    While legend claims Ford melted aluminum coffins to stamp bomber skins, this is an apocryphal myth because secondary mortuary scrap could not meet USAAF Alclad 24S-T specifications.
    Blueprints prove the L-bend was mandated by Runway 09L/27R glide slope approach clearance, debunking the tax avoidance folklore.
  `;

  const badResult = lintScriptContent(badScript, 'test-bad.txt');
  const goodResult = lintScriptContent(goodScript, 'test-good.txt');

  let passed = true;
  if (badResult.errors.length < 3) {
    console.error(`${COLOR.red}FAIL: Expected at least 3 errors on bad script, got ${badResult.errors.length}${COLOR.reset}`);
    passed = false;
  }
  if (!goodResult.pass) {
    console.error(`${COLOR.red}FAIL: Expected good script to pass, got ${goodResult.errors.length} errors${COLOR.reset}`);
    passed = false;
  }

  if (passed) {
    console.log(`${COLOR.green}✓ All self-tests passed successfully (${badResult.errors.length} deliberate errors caught, good script passed clean).${COLOR.reset}`);
  } else {
    process.exit(1);
  }
}

// CLI Execution Entrypoint
if (process.argv[1] && process.argv[1].endsWith('lint-script-claims.mjs')) {
  if (process.argv.includes('--test')) {
    runSelfTests();
    process.exit(0);
  }

  const targetArgs = process.argv.slice(2).filter((arg) => !arg.startsWith('--'));

  if (targetArgs.length === 0) {
    console.log(`Usage: node scripts/lint-script-claims.mjs <file.md|file.txt> [--test]`);
    process.exit(0);
  }

  let totalErrors = 0;
  let totalWarnings = 0;

  for (const filePath of targetArgs) {
    const fullPath = path.resolve(filePath);
    if (!fs.existsSync(fullPath)) {
      console.error(`${COLOR.red}File not found: ${fullPath}${COLOR.reset}`);
      totalErrors++;
      continue;
    }

    const content = fs.readFileSync(fullPath, 'utf8');
    const result = lintScriptContent(content, path.basename(filePath));

    console.log(`\n${COLOR.bold}Analyzing: ${filePath}${COLOR.reset}`);
    if (result.errors.length === 0 && result.warnings.length === 0) {
      console.log(`  ${COLOR.green}✓ All historical claims verified against canonical research.${COLOR.reset}`);
    } else {
      for (const err of result.errors) {
        console.log(`  ${COLOR.red}✗ [ERROR] Line ${err.line} (${err.ruleId}):${COLOR.reset}`);
        console.log(`    Snippet: "${err.content}"`);
        console.log(`    Issue:   ${err.description}`);
        console.log(`    Fix:     ${COLOR.cyan}${err.correction}${COLOR.reset}`);
        console.log(`    Source:  ${err.canonicalNote}`);
        totalErrors++;
      }
      for (const warn of result.warnings) {
        console.log(`  ${COLOR.yellow}! [WARN] Line ${warn.line} (${warn.ruleId}):${COLOR.reset}`);
        console.log(`    Snippet: "${warn.content}"`);
        console.log(`    Issue:   ${warn.description}`);
        console.log(`    Fix:     ${COLOR.cyan}${warn.correction}${COLOR.reset}`);
        totalWarnings++;
      }
    }
  }

  console.log(`\n${COLOR.bold}Summary: ${totalErrors} error(s), ${totalWarnings} warning(s)${COLOR.reset}`);
  if (totalErrors > 0) {
    process.exit(1);
  }
}
