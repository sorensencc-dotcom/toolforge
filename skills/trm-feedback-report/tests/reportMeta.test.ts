import { buildReportMeta, reportFilename } from '../src/reportMeta';

describe('buildReportMeta', () => {
  const fullCompleteness = { has_ocr_timing: true, has_extract: true, has_score: true, has_validate: true };

  it('is fully clean when nothing is missing or skipped', () => {
    expect(buildReportMeta(fullCompleteness, false, false)).toEqual({ partial_report: false, latency_data_stale: false });
  });

  it('flags latency_data_stale (not partial_report) when only ocr timing is missing', () => {
    const completeness = { ...fullCompleteness, has_ocr_timing: false };
    expect(buildReportMeta(completeness, false, false)).toEqual({ partial_report: false, latency_data_stale: true });
  });

  it('flags partial_report when validate/feedback-stats failed to run', () => {
    expect(buildReportMeta(fullCompleteness, true, false)).toEqual({ partial_report: true, latency_data_stale: false });
  });

  it('flags partial_report when the web-search step was skipped', () => {
    expect(buildReportMeta(fullCompleteness, false, true)).toEqual({ partial_report: true, latency_data_stale: false });
  });
});

describe('reportFilename', () => {
  it('includes the topic slug and stats version', () => {
    const name = reportFilename('charlie/benson-ford');
    expect(name).toMatch(/^charlie-benson-ford-feedback-v1-\d+\.md$/);
  });
});
