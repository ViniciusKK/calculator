import { defineConfig } from 'vitest/config'

// Contract tests build and run the real Go server, so they need a Go toolchain
// and are kept out of the default `npm test` run.
export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.contract.test.ts'],
    // `go build` on a cold cache dominates the first run.
    testTimeout: 120_000,
    hookTimeout: 180_000,
  },
})
