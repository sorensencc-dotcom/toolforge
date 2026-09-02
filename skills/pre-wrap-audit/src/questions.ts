export interface AuditAnswer {
  questionNumber: number;
  question: string;
  category: 'core' | 'extended';
  answer: string;
  severity?: 'BLOCKER' | 'WARNING' | 'INFO';
  resolution?: string;
}

export const CORE_QUESTIONS = [
  {
    number: 1,
    category: 'core' as const,
    question: 'Confidence gap: What am I least confident about, and why?',
    guidance: 'Cite specific evidence gap or unverified assumption. Example: "Jest test never ran Wave F code. Only TypeScript compilation verified."'
  },
  {
    number: 2,
    category: 'core' as const,
    question: 'Missing context: What am I missing about this situation?',
    guidance: 'Unexamined substate (dirty repos, untracked files), stakeholders not consulted. Example: "Submodules show untracked content. Unknown if deployment works."'
  },
  {
    number: 3,
    category: 'core' as const,
    question: 'Assumption risk: What assumption would most change the recommendation if wrong?',
    guidance: 'Identify load-bearing assumption. Example: "I assume 90-day retention is correct. If it\'s 60 or 180, prune is wrong."'
  },
  {
    number: 4,
    category: 'core' as const,
    question: 'Verification checklist: What must be verified before acting?',
    guidance: 'Explicit MUST/SHOULD/NICE-TO-HAVE steps with concrete commands or tests. Example: "MUST: Run Wave F test in isolation. SHOULD: Verify alerting rules exist."'
  }
];

export const EXTENDED_FIELDS = [
  {
    number: 5,
    category: 'extended' as const,
    question: 'Dependencies: What external systems must be healthy?',
    guidance: 'Database, APIs, infrastructure, third-party services. Check: Are all online + monitored? What is failure mode if each is down?'
  },
  {
    number: 6,
    category: 'extended' as const,
    question: 'Regression surface: What existing systems could this break?',
    guidance: 'Changed APIs, data schemas, timing guarantees, silent failure modes. Check: Did we test backwards compatibility?'
  },
  {
    number: 7,
    category: 'extended' as const,
    question: 'Documentation accuracy: Are docs actually correct to what was built?',
    guidance: 'Training guides match actual code signatures? Runbooks match actual ops procedures? Check: Have operators reviewed docs against code?'
  },
  {
    number: 8,
    category: 'extended' as const,
    question: 'Rollback readiness: Can we undo this if it fails?',
    guidance: 'Backup exists and is recent? Rollback procedure tested? Recovery time acceptable? Check: Have we rehearsed rollback?'
  },
  {
    number: 9,
    category: 'extended' as const,
    question: 'Known unknowns: What do we know we don\'t know?',
    guidance: 'Unexamined areas, untested edge cases, performance under load not validated, concurrency issues not explored. Check: Is it safe to deploy anyway, or must we investigate?'
  },
  {
    number: 10,
    category: 'extended' as const,
    question: 'Stakeholder alignment: Did everyone who matters know about this?',
    guidance: 'On-call engineer aware? Product/business approved? Legal/compliance signed off (if applicable)? Check: Has decision-maker signed off?'
  },
  {
    number: 11,
    category: 'extended' as const,
    question: 'Data integrity: If this moves/transforms data, is it validated?',
    guidance: 'Migrations tested on production-scale data? Corruption detection + recovery working? Backups exist before execution? Check: Have we run migration dry-run?'
  },
  {
    number: 12,
    category: 'extended' as const,
    question: 'Security surface: Did we introduce vulnerabilities?',
    guidance: 'New authentication/authorization code? Input validation gaps? Exposed secrets or credentials? Check: Has security team reviewed?'
  }
];

export const ALL_QUESTIONS = [...CORE_QUESTIONS, ...EXTENDED_FIELDS];
