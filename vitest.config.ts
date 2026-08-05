import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    coverage: {
      reporter: ['text', 'json-summary']
    }
  },
  resolve: {
    alias: {
      '@shared': new URL('./src/shared', import.meta.url).pathname
    }
  }
})
