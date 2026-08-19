import { defineConfig } from 'tsup';

export default defineConfig([
  {
    entry: {
      index: 'src/index.ts',
      cli: 'src/cli.ts',
    },
    format: ['cjs'],
    outDir: 'dist',
    dts: true,
    clean: false,
    noExternal: [/.*/],
    target: 'node18',
  },
  {
    entry: {
      'lint-heuristics': 'src/cli.ts',
    },
    format: ['cjs'],
    outDir: 'bin',
    clean: false,
    noExternal: [/.*/],
    target: 'node18',
  },
]);
