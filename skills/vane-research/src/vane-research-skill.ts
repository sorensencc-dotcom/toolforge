/**
 * Canonical TypeScript interface definitions for the Vane Research Toolforge skill.
 */

export interface VaneSkillConfig {
  baseUrl?: string;
  enforceLoopbackOnly?: boolean;
  lockPath?: string;
}

export interface VaneSkillInput {
  query: string;
  mode?: 'speed' | 'balanced' | 'quality';
  max_sources?: number;
}

export interface VaneSourceItem {
  source_id: string;
  title: string;
  url: string;
  snippet_preview: string;
}

export interface VaneSkillOutput {
  query: string;
  answer: string;
  sources: VaneSourceItem[];
  mode: 'speed' | 'balanced' | 'quality';
  timing_ms: number;
  content_hash: string;
}

export interface ToolTelemetry {
  duration_ms: number;
  timestamp: string;
  worker_id: string;
}

export interface ToolError {
  code: string;
  message: string;
  fallback_recommended: boolean;
}

export interface ToolResult {
  execution_id: string;
  success: boolean;
  type: 'READ_ONLY';
  data?: VaneSkillOutput;
  error?: ToolError;
  telemetry: ToolTelemetry;
}
