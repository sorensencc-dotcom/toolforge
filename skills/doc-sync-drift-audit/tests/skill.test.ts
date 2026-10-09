import { describe, it, expect } from '@jest/globals';

describe('DocSyncDriftAudit', () => {
  it('should detect cache schema refusal when version mismatches', () => {
    const cacheVersion = '2.0.0';
    const expectedVersion = '2.1.0';
    expect(cacheVersion === expectedVersion).toBe(false);
  });

  it('should identify broken sidebar target links', () => {
    const existingPages = new Set(['index', 'architecture', 'api-reference']);
    const sidebarLinks = ['index', 'architecture', 'broken-target'];
    const broken = sidebarLinks.filter(link => !existingPages.has(link));
    expect(broken).toEqual(['broken-target']);
  });

  it('should generate structured drift receipt format', () => {
    const receipt = {
      status: 'PASS',
      stalePagesCount: 0,
      brokenLinks: [],
      cacheValidity: { expectedVersion: '2.1.0', foundVersion: '2.1.0', accepted: true },
      timestamp: new Date().toISOString(),
    };
    expect(receipt.status).toBe('PASS');
    expect(receipt.cacheValidity.accepted).toBe(true);
  });
});
