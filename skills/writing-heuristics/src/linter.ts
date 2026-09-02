import defaultCatalog from "../heuristics.json";
import * as fs from 'fs';
import * as path from 'path';
import { HeuristicsCatalog, LintOptions, LintResult, Violation } from './types';
import { parseMarkdown } from './parser';
import { SuppressionRegistry } from './suppressions';

export function getCatalog(customPath?: string): HeuristicsCatalog {
  if (customPath) { return JSON.parse(fs.readFileSync(customPath, "utf8")); }
  return defaultCatalog as HeuristicsCatalog;
}

export function lintText(content: string, options: LintOptions = {}): LintResult {
  const catalog = getCatalog();
  const parsed = parseMarkdown(content);
  const suppressions = new SuppressionRegistry(parsed.comments);
  const violations: Violation[] = [];

  // Check expired suppressions
  for (const s of suppressions.getDirectives()) {
    if (s.isExpired) {
      violations.push({
        ruleId: 'suppression-expired',
        ruleName: 'Expired Suppression Directive',
        severity: 'error',
        message: `Suppression for rule "${s.ruleId}" by author "${s.author}" expired on ${s.until}.`,
        line: s.line,
        column: 1,
        autofix: false,
        confidence: 1.0,
      });
    }
  }

  // Evaluate Prose Nodes
  for (const node of parsed.proseNodes) {
    for (const rule of catalog.rules) {
      if (!options.noSuppress && suppressions.isSuppressed(rule.id, node.line)) {
        continue;
      }

      // 1. ban-throat-clearing
      if (rule.id === 'ban-throat-clearing' && node.type === 'paragraph') {
        const regex = /^(Certainly|Sure thing|Sure|Here is|In this section|Let's dive|Note that|Allow me to|Of course)[!,.:]?\s*/i;
        const m = node.text.match(regex);
        if (m) {
          violations.push({
            ruleId: rule.id,
            ruleName: rule.name,
            severity: rule.severity,
            message: `Avoid conversational throat-clearing opener: "${m[0].trim()}".`,
            line: node.line,
            column: node.column,
            autofix: true,
            confidence: rule.confidence,
            fix: {
              range: [0, m[0].length],
              text: '',
            },
          });
        }
      }

      // 2. ban-filler-adverbs
      if (rule.id === 'ban-filler-adverbs') {
        const regex = /\b(essentially|basically|crucial|game-changing|delve|delving|comprehensive|seamlessly|unleash|streamline)\b/gi;
                for (const match of node.text.matchAll(regex)) {
          violations.push({
            ruleId: rule.id,
            ruleName: rule.name,
            severity: rule.severity,
            message: `Avoid filler / slop word: "${match[0]}".`,
            line: node.line,
            column: node.column + match.index,
            autofix: false,
            confidence: rule.confidence,
          });
        }
      }

      // 3. avoid-first-person-plural
      if (rule.id === 'avoid-first-person-plural') {
        const regex = /\b(we recommend|we suggest|we will|in our opinion|let's|our recommendation)\b/gi;
                for (const match of node.text.matchAll(regex)) {
          violations.push({
            ruleId: rule.id,
            ruleName: rule.name,
            severity: rule.severity,
            message: `Avoid first-person plural in technical docs: "${match[0]}".`,
            line: node.line,
            column: node.column + match.index,
            autofix: false,
            confidence: rule.confidence,
          });
        }
      }

      // 4. use-second-person
      if (rule.id === 'use-second-person') {
        const regex = /\b(the user should|the developer should|the engineer must|the reader should)\b/gi;
                for (const match of node.text.matchAll(regex)) {
          violations.push({
            ruleId: rule.id,
            ruleName: rule.name,
            severity: rule.severity,
            message: `Prefer direct imperative or second-person ("you") over third-person: "${match[0]}".`,
            line: node.line,
            column: node.column + match.index,
            autofix: false,
            confidence: rule.confidence,
          });
        }
      }

      // 5. active-voice
      if (rule.id === 'active-voice') {
        const regex = /\b(is|are|was|were|been|being)\s+(?:[a-z]+ed|built|run|written|sent|created|started)(?:\s+[a-z]+)?\s+by\b/gi;
                for (const match of node.text.matchAll(regex)) {
          violations.push({
            ruleId: rule.id,
            ruleName: rule.name,
            severity: rule.severity,
            message: `Passive voice construct detected: "${match[0]}". Use active voice.`,
            line: node.line,
            column: node.column + match.index,
            autofix: false,
            confidence: rule.confidence,
          });
        }
      }

      // 6. assertion-density
      if (rule.id === 'assertion-density') {
        const regex = /\b(vastly superior|incredible speed|ultra fast|blazing fast|extremely powerful|game changing performance)\b/gi;
                for (const match of node.text.matchAll(regex)) {
          violations.push({
            ruleId: rule.id,
            ruleName: rule.name,
            severity: rule.severity,
            message: `Qualitative assertion lacking quantitative grounding: "${match[0]}". Provide metrics.`,
            line: node.line,
            column: node.column + match.index,
            autofix: false,
            confidence: rule.confidence,
          });
        }
      }

      // 7. condition-before-action
      if (rule.id === 'condition-before-action') {
        const regex = /^[A-Z][a-z]+\s+.*\s+(?:if you want to|in order to|if you need to)\b/i;
        if (regex.test(node.text)) {
          violations.push({
            ruleId: rule.id,
            ruleName: rule.name,
            severity: rule.severity,
            message: `State prerequisite/condition before command ("To X, run Y").`,
            line: node.line,
            column: node.column,
            autofix: false,
            confidence: rule.confidence,
          });
        }
      }

      // 8. heading-sentence-case
      if (rule.id === 'heading-sentence-case' && node.type === 'heading') {
        const words = node.text.split(/\s+/);
        let titleCaseCount = 0;
        for (let i = 1; i < words.length; i++) {
          const w = words[i];
          if (/^[A-Z][a-z]{3,}$/.test(w)) {
            titleCaseCount++;
          }
        }
        if (titleCaseCount >= 2) {
          violations.push({
            ruleId: rule.id,
            ruleName: rule.name,
            severity: rule.severity,
            message: `Heading must be Sentence case: "${node.text}".`,
            line: node.line,
            column: node.column,
            autofix: true,
            confidence: rule.confidence,
          });
        }
      }

      // 10. serial-comma
      if (rule.id === 'serial-comma') {
        const regex = /\b([A-Za-z0-9_-]+),\s+([A-Za-z0-9_-]+)\s+(and|or)\s+([A-Za-z0-9_-]+)\b/g;
                for (const match of node.text.matchAll(regex)) {
          violations.push({
            ruleId: rule.id,
            ruleName: rule.name,
            severity: rule.severity,
            message: `Missing serial Oxford comma: "${match[0]}".`,
            line: node.line,
            column: node.column + match.index,
            autofix: false,
            confidence: rule.confidence,
          });
        }
      }
    }
  }

  // Evaluate Link Nodes (Rule 9: descriptive-links)
  for (const link of parsed.linkNodes) {
    if (!options.noSuppress && suppressions.isSuppressed('descriptive-links', link.line)) {
      continue;
    }
    const genericLinkRegex = /^(here|click here|link|this link|this page|read more|more|more info|website)$/i;
    if (genericLinkRegex.test(link.text)) {
      violations.push({
        ruleId: 'descriptive-links',
        ruleName: 'Descriptive Link Text',
        severity: 'error',
        message: `Generic link text "${link.text}" is not descriptive. Name the specific destination.`,
        line: link.line,
        column: link.column,
        autofix: false,
        confidence: 1.0,
      });
    }
  }

  const errorCount = violations.filter((v) => v.severity === 'error').length;
  const warningCount = violations.filter((v) => v.severity === 'warning').length;

  return {
    filePath: options.filePath,
    clean: violations.length === 0,
    errorCount,
    warningCount,
    violations,
    suppressions: suppressions.getDirectives(),
  };
}

export async function lintFile(filePath: string, options: LintOptions = {}): Promise<LintResult> {
  const content = fs.readFileSync(filePath, 'utf8');
  return lintText(content, { ...options, filePath });
}
