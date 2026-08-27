import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    globals: false,
    // Integration tests share a DB; keep them serial to avoid cross-test races.
    fileParallelism: false,
    hookTimeout: 30_000,
    testTimeout: 30_000,
  },
});
