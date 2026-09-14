import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import electronCornerSmoothingPostcss from './electron-corner-smoothing-postcss'

export default defineConfig({
  plugins: [vue()],
  css: { postcss: { plugins: [electronCornerSmoothingPostcss()] } },
  server: { host: '127.0.0.1', port: 5198, strictPort: true }
})
