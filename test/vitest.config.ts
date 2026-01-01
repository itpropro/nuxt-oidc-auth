import { resolve } from 'node:path'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    // Global test configuration
    globals: true,
    environment: 'node',

    // Root directory for tests
    root: resolve(__dirname, '..'),

    // Include patterns for different test types
    include: [
      'test/unit/**/*.test.ts',
      'test/functional/**/*.test.ts',
    ],

    // Exclude E2E tests (run with Playwright)
    exclude: [
      'test/e2e/**/*.test.ts',
      '**/node_modules/**',
      '**/dist/**',
    ],

    // Coverage configuration
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      include: ['src/runtime/**/*.ts'],
      exclude: [
        'src/runtime/types.ts',
        '**/*.d.ts',
      ],
    },

    // Test isolation
    isolate: true,
    pool: 'threads',

    // Timeouts
    testTimeout: 10000,
    hookTimeout: 10000,
  },
})
