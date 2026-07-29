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

  it('recovers stdout when the trm binary exits non-zero but printed output first', () => {
    const error = new Error('Command failed: trm validate') as Error & { stdout?: string };
    error.stdout = '{"valid":false,"errors":["topic X invalid"]}';
    (execFileSync as jest.Mock).mockImplementation(() => {
      throw error;
    });

    const output = runTrmCommand('/vault/root', ['validate', 'charlie/benson-ford', '--recursive']);

    expect(output).toBe('{"valid":false,"errors":["topic X invalid"]}');
  });

  it('rethrows when the trm binary fails with no usable stdout', () => {
    const error = new Error('spawn trm ENOENT') as Error & { stdout?: string };
    error.stdout = '';
    (execFileSync as jest.Mock).mockImplementation(() => {
      throw error;
    });

    expect(() =>
      runTrmCommand('/vault/root', ['validate', 'charlie/benson-ford', '--recursive'])
    ).toThrow('spawn trm ENOENT');
  });
});
