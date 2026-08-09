import react from '@vitejs/plugin-react'
import { configDefaults, defineConfig } from 'vitest/config'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: './src/test-setup.ts',
    // Contract tests boot the real Go server; they run via `npm run test:contract`.
    exclude: [...configDefaults.exclude, '**/*.contract.test.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'lcov'],
      reportsDirectory: './coverage',
      include: ['src/**/*.{ts,tsx}'],
      exclude: [
        'src/**/*.test.{ts,tsx}',
        'src/main.tsx', // the mount point, exercised by the browser not by unit tests
        'src/test-setup.ts',
        'src/vite-env.d.ts',
      ],
    },
  },
  server: {
    // Forward API calls to the Go backend so the browser sees a single origin.
    proxy: {
      '/api': 'http://localhost:8080',
    },
  },
})
