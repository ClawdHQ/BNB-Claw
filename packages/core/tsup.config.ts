import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm'],
  dts: true,
  outExtension({ format }) {
    return {
      js: `.js`,
      dts: `.d.ts`,
    };
  },
});
