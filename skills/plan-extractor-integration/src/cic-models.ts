// cic-models.ts
// Model definitions for Content Intelligence Core (CIC) integration

export interface CicNode {
  id: string;
  path: string;
  size: number;
  type: string;
}

export interface CicEdge {
  from: string;
  to: string;
  type: string;
}

export interface CicSecurityIssue {
  file: string;
  line: number;
  type: string;
  severity: string;
}

export interface CicPatternHit {
  file: string;
  line: number;
  type: string;
}

export interface CicImpact {
  file: string;
  affected: string[];
}
