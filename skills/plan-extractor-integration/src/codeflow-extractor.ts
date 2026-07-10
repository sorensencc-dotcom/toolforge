// codeflow-extractor.ts
// Maps CodeFlow analyzer output format to CIC models

import type { CicNode, CicEdge, CicSecurityIssue, CicPatternHit, CicImpact } from "./cic-models";

export class CodeFlowExtractor {
  constructor(private repoId: string) {}

  extractNodes(result: any): CicNode[] {
    if (!result || !Array.isArray(result.files)) return [];
    return result.files.map((f: any) => ({
      id: `${this.repoId}:${f.path}`,
      path: f.path,
      size: f.size,
      type: "file"
    }));
  }

  extractEdges(result: any): CicEdge[] {
    if (!result || !Array.isArray(result.edges)) return [];
    return result.edges.map((e: any) => ({
      from: `${this.repoId}:${e.from}`,
      to: `${this.repoId}:${e.to}`,
      type: e.type || "import"
    }));
  }

  extractSecurity(result: any): CicSecurityIssue[] {
    if (!result || !Array.isArray(result.security)) return [];
    return result.security.map((s: any) => ({
      file: s.file,
      line: s.line,
      type: s.type,
      severity: s.severity
    }));
  }

  extractPatterns(result: any): CicPatternHit[] {
    if (!result || !Array.isArray(result.patterns)) return [];
    return result.patterns.map((p: any) => ({
      file: p.file,
      line: p.line,
      type: p.type
    }));
  }

  extractImpact(result: any): CicImpact[] {
    if (!result || !Array.isArray(result.blastRadius)) return [];
    return result.blastRadius.map((b: any) => ({
      file: b.file,
      affected: b.affected.map((a: string) => `${this.repoId}:${a}`)
    }));
  }
}
