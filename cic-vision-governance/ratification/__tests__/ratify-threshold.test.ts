import { ratifyThreshold, loadArtifact, saveArtifact } from '../ratify-threshold';
import * as fs from 'fs';
import * as path from 'path';

jest.mock('fs');

describe('ratifyThreshold', () => {
  const mockArtifact = {
    artifact_type: 'CIC-VISION-THRESHOLD',
    version: 'v001',
    timestamp: '2026-07-21T00:00:00Z',
    baseline_avg: 0.72,
    structure_avg: 0.72,
    enrichment_delta_avg: 0.10,
    current_threshold: 0.72,
    provider_chain_stats: {},
    update_reason: 'initialization',
    executed_by: 'ACTOR-001',
    status: 'pending',
    parent_lineage: null,
    hash: 'abc123',
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('loadArtifact', () => {
    it('loads artifact from file', async () => {
      (fs.readFileSync as jest.Mock).mockReturnValue(
        JSON.stringify(mockArtifact)
      );

      const artifact = loadArtifact('v001');

      expect(artifact).toEqual(mockArtifact);
      expect(fs.readFileSync).toHaveBeenCalledWith(
        expect.stringContaining('v001'),
        'utf-8'
      );
    });

    it('throws if artifact file not found', () => {
      (fs.readFileSync as jest.Mock).mockImplementation(() => {
        throw new Error('ENOENT');
      });

      expect(() => loadArtifact('v999')).toThrow();
    });
  });

  describe('saveArtifact', () => {
    it('saves artifact to file', async () => {
      (fs.writeFileSync as jest.Mock).mockImplementation(() => {});

      saveArtifact(mockArtifact);

      expect(fs.writeFileSync).toHaveBeenCalledWith(
        expect.stringContaining(mockArtifact.version),
        expect.stringContaining('"status":"ratified"'),
        'utf-8'
      );
    });
  });

  describe('ratifyThreshold', () => {
    it('ratifies pending artifact', async () => {
      (fs.readFileSync as jest.Mock).mockReturnValue(
        JSON.stringify(mockArtifact)
      );
      (fs.writeFileSync as jest.Mock).mockImplementation(() => {});
      (fs.appendFileSync as jest.Mock).mockImplementation(() => {});

      await ratifyThreshold('v001', 'ACTOR-001');

      const calls = (fs.writeFileSync as jest.Mock).mock.calls;
      const saveCall = calls.find((c: any[]) =>
        c[0].includes('v001')
      );

      expect(saveCall).toBeDefined();
      expect(saveCall[1]).toContain('"status":"ratified"');
    });

    it('rejects if actor does not match executor', async () => {
      (fs.readFileSync as jest.Mock).mockReturnValue(
        JSON.stringify(mockArtifact)
      );

      await expect(
        ratifyThreshold('v001', 'ACTOR-999')
      ).rejects.toThrow(/Only the executing actor/);
    });

    it('appends lineage entry on ratification', async () => {
      (fs.readFileSync as jest.Mock).mockReturnValue(
        JSON.stringify(mockArtifact)
      );
      (fs.writeFileSync as jest.Mock).mockImplementation(() => {});
      (fs.appendFileSync as jest.Mock).mockImplementation(() => {});

      await ratifyThreshold('v001', 'ACTOR-001');

      expect(fs.appendFileSync).toHaveBeenCalledWith(
        expect.stringContaining('lineage-log.json'),
        expect.stringContaining('"operation":"RATIFY"'),
        'utf-8'
      );
    });

    it('updates timestamp on ratification', async () => {
      const oldArtifact = { ...mockArtifact };
      oldArtifact.timestamp = '2026-07-21T00:00:00Z';

      (fs.readFileSync as jest.Mock).mockReturnValue(
        JSON.stringify(oldArtifact)
      );
      (fs.writeFileSync as jest.Mock).mockImplementation(() => {});
      (fs.appendFileSync as jest.Mock).mockImplementation(() => {});

      await ratifyThreshold('v001', 'ACTOR-001');

      const calls = (fs.writeFileSync as jest.Mock).mock.calls;
      const saveCall = calls.find((c: any[]) =>
        c[0].includes('v001')
      );

      expect(saveCall[1]).not.toContain('2026-07-21T00:00:00Z');
    });
  });

  describe('validation', () => {
    it('validates artifact schema before ratifying', async () => {
      const invalidArtifact = { ...mockArtifact };
      delete (invalidArtifact as any).hash;

      (fs.readFileSync as jest.Mock).mockReturnValue(
        JSON.stringify(invalidArtifact)
      );

      await expect(
        ratifyThreshold('v001', 'ACTOR-001')
      ).rejects.toThrow();
    });

    it('rejects artifact not in pending state', async () => {
      const ratifiedArtifact = { ...mockArtifact };
      ratifiedArtifact.status = 'ratified';

      (fs.readFileSync as jest.Mock).mockReturnValue(
        JSON.stringify(ratifiedArtifact)
      );

      await expect(
        ratifyThreshold('v001', 'ACTOR-001')
      ).rejects.toThrow(/already ratified/);
    });
  });
});
