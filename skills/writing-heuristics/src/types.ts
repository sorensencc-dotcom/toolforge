export type RuleSeverity = 'error' | 'warning';

export interface RuleDefinition {
  id: string;
  name: string;
  severity: RuleSeverity;
  autofix: boolean;
  confidence: number;
  advisory?: boolean;
  category: 'google-style' | 'anti-slop' | 'governance';
  description: string;
  rationale: string;
  patterns?: string[];
  passExample: string;
  failExample: string;
}

export interface HeuristicsCatalog {
  version: string;
  lastUpdated: string;
  rules: RuleDefinition[];
}

export interface Violation {
  ruleId: string;
  ruleName: string;
  severity: RuleSeverity;
  message: string;
  line: number;
  column: number;
  endLine?: number;
  endColumn?: number;
  autofix: boolean;
  confidence: number;
  fix?: {
    range: [number, number];
    text: string;
  };
}

export interface SuppressionDirective {
  ruleId: string;
  author: string;
  reason: string;
  until?: string; // YYYY-MM-DD
  line: number;
  isExpired: boolean;
  active: boolean;
}

export interface LintResult {
  filePath?: string;
  clean: boolean;
  errorCount: number;
  warningCount: number;
  violations: Violation[];
  suppressions: SuppressionDirective[];
}

export interface LintOptions {
  strict?: boolean;
  filePath?: string;
  noSuppress?: boolean;
}

export interface FixOptions {
  dryRun?: boolean;
  strict?: boolean;
  noBackup?: boolean;
}

export interface FixResult {
  originalContent: string;
  fixedContent: string;
  appliedCount: number;
  diff?: string;
  clean: boolean;
}

export interface FixFileResult extends FixResult {
  filePath: string;
  backupPath?: string;
}
