import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    coverage: {
      exclude: ['src/__tests__/**'],
      include: ['src/**/*.ts'],
      provider: 'v8',
      reporter: ['text'],
      thresholds: {
        branches: 100,
        functions: 100,
        lines: 100,
        statements: 100
      }
    },
    environment: 'node',
    globals: true
  }
});
