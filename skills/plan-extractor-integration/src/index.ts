// index.ts
// Unified entry point for CodeFlow extraction into CIC stores

import { CodeFlowClient } from "./codeflow-client";
import { CodeFlowExtractor } from "./codeflow-extractor";
import { recordExtractorMetrics, recordExtractorLog } from "../../../../cic-observability";
import type { CicNode, CicEdge, CicSecurityIssue, CicPatternHit, CicImpact } from "./cic-models";

interface ExtractorStore {
  storeNodes: (nodes: CicNode[]) => Promise<void>;
  storeEdges: (edges: CicEdge[]) => Promise<void>;
  storeSecurity: (issues: CicSecurityIssue[]) => Promise<void>;
  storePatterns: (patterns: CicPatternHit[]) => Promise<void>;
  storeImpact: (impact: CicImpact[]) => Promise<void>;
}

export class ExtractorOrchestrator {
  private client: CodeFlowClient;

  constructor(
    private repoId: string,
    private repoPath: string,
    private store: ExtractorStore,
    codeflowUrl: string = "http://codeflow-analyzer:8080"
  ) {
    this.client = new CodeFlowClient(codeflowUrl);
  }

  async run(): Promise<ExtractorResult> {
    const startTime = Date.now();

    try {
      recordExtractorLog(this.repoId, {
        event: "extraction_started",
        repo_path: this.repoPath
      });

      // Call CodeFlow analyzer
      const codeflowResult = await this.client.analyze(this.repoPath);

      // Extract into CIC models
      const extractor = new CodeFlowExtractor(this.repoId);

      const nodes = extractor.extractNodes(codeflowResult);
      const edges = extractor.extractEdges(codeflowResult);
      const security = extractor.extractSecurity(codeflowResult);
      const patterns = extractor.extractPatterns(codeflowResult);
      const impact = extractor.extractImpact(codeflowResult);

      // Persist to stores (in parallel)
      await Promise.all([
        this.store.storeNodes(nodes),
        this.store.storeEdges(edges),
        this.store.storeSecurity(security),
        this.store.storePatterns(patterns),
        this.store.storeImpact(impact)
      ]);

      const duration = Date.now() - startTime;

      const result: ExtractorResult = {
        status: "ok",
        repoId: this.repoId,
        duration_ms: duration,
        extracted: {
          nodes: nodes.length,
          edges: edges.length,
          security: security.length,
          patterns: patterns.length,
          impact: impact.length
        }
      };

      recordExtractorMetrics(this.repoId, result as any);
      recordExtractorLog(this.repoId, {
        event: "extraction_complete",
        duration_ms: duration,
        extracted: result.extracted
      });

      return result;
    } catch (error) {
      const duration = Date.now() - startTime;

      recordExtractorLog(this.repoId, {
        event: "extraction_failed",
        duration_ms: duration,
        error_message: error instanceof Error ? error.message : String(error),
        error_type: error?.constructor?.name || "Unknown"
      });

      throw error;
    }
  }
}

export interface ExtractorResult {
  status: "ok" | "error";
  repoId: string;
  duration_ms: number;
  extracted: {
    nodes: number;
    edges: number;
    security: number;
    patterns: number;
    impact: number;
  };
}

// Factory for creating orchestrator with CIC defaults
export function createOrchestrator(
  repoId: string,
  repoPath: string,
  store: ExtractorStore
): ExtractorOrchestrator {
  return new ExtractorOrchestrator(
    repoId,
    repoPath,
    store,
    process.env.CODEFLOW_ANALYZER_URL || "http://codeflow-analyzer:8080"
  );
}
