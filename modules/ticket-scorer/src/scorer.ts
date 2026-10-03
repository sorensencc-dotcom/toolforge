import { unified } from 'unified';
import remarkParse from 'remark-parse';
import { visit } from 'unist-util-visit';
import type { Node, Parent } from 'unist';
import {
  DEFAULT_CONFIG,
  type PriorityTier,
  type ScoreBreakdown,
  type ScorerConfig,
  type ScorerOptions,
  type TicketScoreResult,
} from './types.js';
import { hasAffirmativeMatch } from './negation-matcher.js';

interface ListItemNode extends Parent {
  type: 'listItem';
  checked?: boolean | null;
}

interface TextNode extends Node {
  type: 'text';
  value: string;
}

export class DeterministicTicketScorer {
  private config: ScorerConfig;
  private processor = unified().use(remarkParse);

  constructor(options?: ScorerOptions) {
    this.config = {
      knownDomains: options?.knownDomains ?? DEFAULT_CONFIG.knownDomains,
      urgencyKeywords: options?.urgencyKeywords ?? DEFAULT_CONFIG.urgencyKeywords,
      minBodyWordCount: options?.minBodyWordCount ?? DEFAULT_CONFIG.minBodyWordCount,
      overrideP0Keywords: options?.overrideP0Keywords ?? DEFAULT_CONFIG.overrideP0Keywords,
      scoreThresholds: {
        p0: options?.scoreThresholds?.p0 ?? DEFAULT_CONFIG.scoreThresholds.p0,
        p1: options?.scoreThresholds?.p1 ?? DEFAULT_CONFIG.scoreThresholds.p1,
        p2: options?.scoreThresholds?.p2 ?? DEFAULT_CONFIG.scoreThresholds.p2,
      },
    };
  }

  public score(rawMarkdown: string): TicketScoreResult {
    const flags: string[] = [];
    const tree = this.processor.parse(rawMarkdown);

    let totalHeadings = 0;
    let totalChecklists = 0;
    let checkedItems = 0;
    let codeBlockCount = 0;
    let inlineCodeCount = 0;
    let textContent = '';

    visit(tree, (node: Node) => {
      if (node.type === 'heading') {
        totalHeadings++;
      } else if (node.type === 'listItem') {
        const item = node as ListItemNode;
        if (typeof item.checked === 'boolean') {
          totalChecklists++;
          if (item.checked) checkedItems++;
        } else {
          const firstChild = item.children?.[0] as Parent | undefined;
          const firstText = (firstChild?.children?.[0] ?? firstChild) as TextNode | undefined;
          if (firstText && firstText.type === 'text') {
            const match = firstText.value.match(/^\[([ xX])\]/);
            if (match) {
              totalChecklists++;
              if (match[1].toLowerCase() === 'x') checkedItems++;
            }
          }
        }
      } else if (node.type === 'code') {
        codeBlockCount++;
      } else if (node.type === 'inlineCode') {
        inlineCodeCount++;
      } else if (node.type === 'text') {
        textContent += ' ' + (node as TextNode).value;
      }
    });

    const normalizedText = textContent.toLowerCase();
    const words = normalizedText.trim().split(/\s+/).filter(Boolean);
    const wordCount = words.length;

    // 1. Completeness Evaluation (Max 35)
    let completeness = 0;
    if (wordCount >= this.config.minBodyWordCount) {
      completeness += 10;
    } else {
      flags.push('LOW_WORD_COUNT');
    }

    if (totalHeadings >= 2) {
      completeness += 10;
    } else if (totalHeadings === 1) {
      completeness += 5;
    }

    if (codeBlockCount > 0) {
      completeness += 15;
    } else if (inlineCodeCount > 0) {
      completeness += 8;
    }
    completeness = Math.min(35, completeness);

    // 2. Actionability Evaluation (Max 15)
    let actionability = 0;
    if (totalChecklists > 0) {
      actionability += 10;
      if (totalChecklists >= 3) {
        actionability += 5;
      }
    } else {
      flags.push('MISSING_CHECKLIST_CRITERIA');
    }
    actionability = Math.min(15, actionability);

    // 3. Urgency Indicators (Max 30)
    let urgency = 0;
    for (const [kw, weight] of Object.entries(this.config.urgencyKeywords)) {
      if (hasAffirmativeMatch(normalizedText, kw)) {
        urgency += weight;
        flags.push(`KEYWORD_${kw.toUpperCase()}`);
      }
    }
    urgency = Math.min(30, urgency);

    // 4. Domain Relevance (Max 20)
    let domainScore = 0;
    let matchedDomains = 0;
    for (const domain of this.config.knownDomains) {
      const regex = new RegExp(`\\b${domain}\\b`, 'i');
      if (regex.test(normalizedText)) {
        domainScore += 10;
        matchedDomains++;
        flags.push(`DOMAIN_${domain.toUpperCase()}`);
      }
    }
    if (matchedDomains === 0) {
      flags.push('UNRECOGNIZED_DOMAIN');
    }
    domainScore = Math.min(20, domainScore);

    const totalScore = completeness + actionability + urgency + domainScore;
    const tier = this.resolveTier(totalScore, flags);

    return {
      totalScore,
      tier,
      breakdown: {
        completeness,
        urgency,
        domainScope: domainScore,
        actionability,
      },
      flags,
    };
  }

  private resolveTier(score: number, flags: string[]): PriorityTier {
    // Explicit override: Check if any normalized override keyword is present in flags
    for (const kw of this.config.overrideP0Keywords) {
      if (flags.includes(`KEYWORD_${kw.toUpperCase()}`)) {
        return 'P0';
      }
    }

    if (score >= this.config.scoreThresholds.p0) return 'P0';
    if (score >= this.config.scoreThresholds.p1) return 'P1';
    if (score >= this.config.scoreThresholds.p2) return 'P2';
    return 'P3';
  }
}
