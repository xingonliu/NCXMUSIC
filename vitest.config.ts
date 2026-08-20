import vue from '@vitejs/plugin-vue'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  plugins: [vue()],
  test: {
    setupFiles: ['tests/setup.ts'],
    coverage: {
      provider: 'v8'
    },
    include: ['tests/**/*.test.ts']
  }
})
