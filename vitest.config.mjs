import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['test/*.test.mjs', 'test/tooling/*.test.mjs'],
    exclude: [
      '**/node_modules/**',
      '**/dist/**',
      '**/coverage/**',
      '**/work/**',
      'test/package/**',
      'test/native/**',
      'test/**/*.test.ts',
    ],
    pool: 'forks',
    maxWorkers: 4,
    isolate: true,
    allowOnly: false,
    // Dependency/configuration changes must also invalidate raw `vitest --changed` runs.
    forceRerunTriggers: [
      '**/vitest.config.*',
      '**/vite.config.*',
      '**/package.json',
      '**/package-lock.json',
      '**/tsconfig*.json',
      '**/biome.json',
      '**/biome.jsonc',
      '**/scripts/**',
      // Type-only dependencies and the public barrel are explicit contract boundaries.
      '**/src/index.ts',
      '**/src/model.ts',
    ],
    coverage: {
      provider: 'v8',
      include: ['src/**/*.ts'],
      exclude: ['src/model.ts'],
      reporter: ['text', 'json', 'html'],
      thresholds: {
        lines: 100,
        functions: 100,
        statements: 100,
        branches: 99,
      },
    },
  },
});
