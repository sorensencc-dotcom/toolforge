import { AutonomousContextManager } from '../src/index';

describe('AutonomousContextManager', () => {
  let manager: AutonomousContextManager;

  beforeEach(() => {
    manager = new AutonomousContextManager();
  });

  it('should check autonomous mode', () => {
    const result = manager.isAutonomousMode();
    expect(typeof result).toBe('boolean');
  });

  it('should get context', () => {
    const context = manager.getContext();
    expect(context === null || typeof context === 'object').toBe(true);
  });
});
