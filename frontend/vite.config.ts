import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: './src/test-setup.ts',
  },
  server: {
    // Forward API calls to the Go backend so the browser sees a single origin.
    proxy: {
      '/api': 'http://localhost:8080',
    },
  },
})
