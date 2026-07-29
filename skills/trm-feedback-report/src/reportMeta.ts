export interface Completeness {
  has_ocr_timing: boolean;
  has_extract: boolean;
  has_score: boolean;
  has_validate: boolean;
}

export interface ReportMeta {
  partial_report: boolean;
  latency_data_stale: boolean;
}

export function buildReportMeta(completeness: Completeness, hardFailure: boolean, webSearchSkipped: boolean): ReportMeta {
  return {
    partial_report: hardFailure || webSearchSkipped,
    latency_data_stale: !completeness.has_ocr_timing,
  };
}

export function reportFilename(topicPath: string, statsVersion: string = 'v1'): string {
  const slug = topicPath.replace(/\//g, '-');
  const stamp = Date.now();
  return `${slug}-feedback-${statsVersion}-${stamp}.md`;
}
