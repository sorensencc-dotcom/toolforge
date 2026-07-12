import { orchestratePipeline, PipelineStage, PipelineState } from '../src/index';

function stage(name: string, status: PipelineStage['status']): PipelineStage {
  return { name, status };
}

function state(stages: PipelineStage[]): PipelineState {
  return { stages };
}

describe('RewriteLabsOrchestrator', () => {
  describe('input validation', () => {
    it('throws when pipelineState is null', () => {
      expect(() => orchestratePipeline({ pipelineState: null as any })).toThrow(
        'pipelineState is required and must be an object'
      );
    });

    it('throws when pipelineState is undefined', () => {
      expect(() => orchestratePipeline({ pipelineState: undefined as any })).toThrow(
        'pipelineState is required and must be an object'
      );
    });

    it('throws when pipelineState is not an object (string)', () => {
      expect(() => orchestratePipeline({ pipelineState: 'not-an-object' as any })).toThrow(
        'pipelineState is required and must be an object'
      );
    });

    it('does not throw for a valid empty pipelineState object', () => {
      expect(() => orchestratePipeline({ pipelineState: state([]) })).not.toThrow();
    });

    it('defaults to an empty stage list when stages is missing', () => {
      const result = orchestratePipeline({ pipelineState: {} as PipelineState });
      expect(result.totalStages).toBe(0);
      expect(result.completedStages).toBe(0);
    });
  });

  describe('stage progression counting', () => {
    it('computes totalStages from the stage list', () => {
      const result = orchestratePipeline({
        pipelineState: state([stage('a', 'pending'), stage('b', 'running'), stage('c', 'complete')]),
      });
      expect(result.totalStages).toBe(3);
    });

    it('computes completedStages count', () => {
      const result = orchestratePipeline({
        pipelineState: state([stage('a', 'complete'), stage('b', 'complete'), stage('c', 'pending')]),
      });
      expect(result.completedStages).toBe(2);
    });

    it('computes progressPercent as a partial ratio', () => {
      const result = orchestratePipeline({
        pipelineState: state([stage('a', 'complete'), stage('b', 'pending'), stage('c', 'pending'), stage('d', 'pending')]),
      });
      expect(result.progressPercent).toBeCloseTo(25);
    });

    it('computes progressPercent as 100 when all stages complete', () => {
      const result = orchestratePipeline({
        pipelineState: state([stage('a', 'complete'), stage('b', 'complete')]),
      });
      expect(result.progressPercent).toBe(100);
    });

    it('does not divide by zero when stages list is empty', () => {
      const result = orchestratePipeline({ pipelineState: state([]) });
      expect(result.progressPercent).toBe(0);
    });
  });

  describe('blocker handling', () => {
    it('reports blockedStages count', () => {
      const result = orchestratePipeline({
        pipelineState: state([stage('a', 'blocked'), stage('b', 'running')]),
      });
      expect(result.blockedStages).toBe(1);
    });

    it('lists blockedStageNames for a single blocker', () => {
      const result = orchestratePipeline({
        pipelineState: state([stage('deploy', 'blocked'), stage('test', 'running')]),
      });
      expect(result.blockedStageNames).toEqual(['deploy']);
    });

    it('lists blockedStageNames for multiple blockers', () => {
      const result = orchestratePipeline({
        pipelineState: state([stage('deploy', 'blocked'), stage('review', 'blocked'), stage('test', 'complete')]),
      });
      expect(result.blockedStageNames).toEqual(['deploy', 'review']);
    });

    it('adds an "Unblock" next step naming the blocked stages', () => {
      const result = orchestratePipeline({
        pipelineState: state([stage('deploy', 'blocked'), stage('review', 'blocked')]),
      });
      expect(result.nextSteps).toContain('Unblock: deploy, review');
    });

    it('suggests reviewing blockers and requesting assistance when blocked', () => {
      const result = orchestratePipeline({
        pipelineState: state([stage('deploy', 'blocked')]),
      });
      expect(result.suggestedActions).toEqual(['Review blockers', 'Request assistance']);
    });

    it('produces no suggestedActions when no stage is blocked', () => {
      const result = orchestratePipeline({
        pipelineState: state([stage('a', 'running'), stage('b', 'pending')]),
      });
      expect(result.suggestedActions).toEqual([]);
    });
  });

  describe('orchestration flow', () => {
    it('suggests starting the first pending stage when nothing is running', () => {
      const result = orchestratePipeline({
        pipelineState: state([stage('a', 'complete'), stage('b', 'pending'), stage('c', 'pending')]),
      });
      expect(result.nextSteps).toContain('Start: b');
    });

    it('does not suggest starting a stage while one is already running', () => {
      const result = orchestratePipeline({
        pipelineState: state([stage('a', 'running'), stage('b', 'pending')]),
      });
      expect(result.nextSteps.some(step => step.startsWith('Start:'))).toBe(false);
    });

    it('reports "Pipeline running normally" when nothing is blocked and a stage is actively running', () => {
      const result = orchestratePipeline({
        pipelineState: state([stage('a', 'complete'), stage('b', 'running'), stage('c', 'pending')]),
      });
      expect(result.nextSteps).toEqual(['Pipeline running normally']);
    });
  });
});
