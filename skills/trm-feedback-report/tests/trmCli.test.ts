import { execFileSync } from 'node:child_process';
import { runTrmCommand } from '../src/trmCli';

jest.mock('node:child_process');

describe('runTrmCommand', () => {
  it('shells out to the trm binary with the given args and cwd', () => {
    (execFileSync as jest.Mock).mockReturnValue('{"ok":true}');
    const output = runTrmCommand('/vault/root', ['feedback-stats', 'charlie/benson-ford', '--recursive']);
    expect(execFileSync).toHaveBeenCalledWith(
      'trm',
      ['feedback-stats', 'charlie/benson-ford', '--recursive'],
      { cwd: '/vault/root', encoding: 'utf-8' }
    );
    expect(output).toBe('{"ok":true}');
  });
});
