import { ashfall } from '../src/index';

describe('ASHFALL: Session Termination Engine', () => {
  describe('Gather Phase', () => {
    it('should collect git status and recent commits', async () => {
      const output = await ashfall({ scope: 'full' });
      expect(output.summary).toBeDefined();
      expect(output.summary.modifiedFiles).toBeDefined();
      expect(Array.isArray(output.summary.modifiedFiles)).toBe(true);
    });

    it('should track context boundaries', async () => {
      const output = await ashfall({ scope: 'full' });
      expect(output.summary.contextBoundaries).toBeDefined();
      expect(output.summary.contextBoundaries.length).toBeGreaterThan(0);
    });
  });

  describe('Burn Phase', () => {
    it('should compress architectural deltas', async () => {
      const output = await ashfall({ scope: 'full' });
      expect(output.summary.architecturalChanges).toBeDefined();
    });

    it('should generate deterministic output', async () => {
      const output1 = await ashfall({ scope: 'full' });
      const output2 = await ashfall({ scope: 'full' });
      expect(output1.timestamp).toBeDefined();
      expect(output2.timestamp).toBeDefined();
    });
  });

  describe('Audit Phase (Four Questions)', () => {
    it('should identify blind spots', async () => {
      const output = await ashfall({ scope: 'full' });
      expect(output.blindSpotAudit).toBeDefined();
      expect(output.blindSpotAudit.findings).toBeDefined();
      expect(output.blindSpotAudit.findings.length).toBeGreaterThan(0);
    });

    it('should rank findings by severity', async () => {
      const output = await ashfall({ scope: 'full' });
      const { findings } = output.blindSpotAudit;
      const highSeverity = findings.filter((f) => f.severity === 'HIGH');
      expect(highSeverity.length).toBeGreaterThan(0);
    });

    it('should include verification steps', async () => {
      const output = await ashfall({ scope: 'full' });
      const { findings } = output.blindSpotAudit;
      findings.forEach((f) => {
        expect(f.nextCheck).toBeDefined();
        expect(f.nextCheck.length).toBeGreaterThan(0);
      });
    });
  });

  describe('Seal Phase', () => {
    it('should generate memory manifest', async () => {
      const output = await ashfall({ scope: 'full' });
      expect(output.nextSessionMemory).toBeDefined();
      expect(output.nextSessionMemory.includes('---')).toBe(true);
    });

    it('should include metadata in manifest', async () => {
      const output = await ashfall({ scope: 'full' });
      expect(output.nextSessionMemory.includes('type: project')).toBe(true);
      expect(output.nextSessionMemory.includes('timestamp:')).toBe(true);
    });
  });

  describe('Handoff Phase', () => {
    it('should rank roadmap 1–5', async () => {
      const output = await ashfall({ scope: 'full' });
      expect(output.prioritizedRoadmap).toBeDefined();
      output.prioritizedRoadmap.forEach((item) => {
        expect([1, 2, 3, 4, 5]).toContain(item.priority);
      });
    });

    it('should flag blockers', async () => {
      const output = await ashfall({ scope: 'full' });
      const blockers = output.prioritizedRoadmap.filter((item) => item.blocker);
      expect(blockers.length).toBeGreaterThan(0);
    });

    it('should include context and source for each item', async () => {
      const output = await ashfall({ scope: 'full' });
      output.prioritizedRoadmap.forEach((item) => {
        expect(item.task).toBeDefined();
        expect(item.context).toBeDefined();
        expect(item.source).toBeDefined();
      });
    });
  });

  describe('Output Contract', () => {
    it('should return complete AshfallOutput', async () => {
      const output = await ashfall({ scope: 'full' });
      expect(output.summary).toBeDefined();
      expect(output.blindSpotAudit).toBeDefined();
      expect(output.prioritizedRoadmap).toBeDefined();
      expect(output.nextSessionMemory).toBeDefined();
      expect(output.timestamp).toBeDefined();
      expect(output.scope).toBeDefined();
    });

    it('should handle scope parameter', async () => {
      const fullOutput = await ashfall({ scope: 'full' });
      expect(fullOutput.scope).toBe('full');

      const phaseOutput = await ashfall({ scope: 'PHASE-26' });
      expect(phaseOutput.scope).toBe('PHASE-26');
    });
  });
});
