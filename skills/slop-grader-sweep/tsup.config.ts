import { defineConfig } from 'tsup';

export default defineConfig({
  entry: {
    cli: 'src/cli.ts',
  },
  format: ['cjs'],
  outDir: 'dist',
  dts: false,
  clean: true,
  noExternal: [/.*/],
  target: 'node18',
});
