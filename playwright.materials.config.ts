import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: './tests/materials',
  workers: 1,
  timeout: 30000,
  outputDir: './output/playwright/materials',
  webServer: {
    command: 'node scripts/serve-glass-materials.mjs',
    url: 'http://127.0.0.1:5198/tests/fixtures/glass-materials/index.html',
    reuseExistingServer: false
  }
})
