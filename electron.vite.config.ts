import { resolve } from 'node:path'

import tailwindcss from '@tailwindcss/vite'
import vue from '@vitejs/plugin-vue'
import { defineConfig } from 'electron-vite'

export default defineConfig({
  main: {
    build: {
      externalizeDeps: {
        exclude: ['zod']
      },
      rollupOptions: {
        input: {
          index: resolve(__dirname, 'src/main/index.ts'),
          utility: resolve(__dirname, 'src/utility/index.ts'),
          inputHook: resolve(__dirname, 'src/input-hook/index.ts'),
          localAsr: resolve(__dirname, 'src/local-asr/index.ts'),
          skillHost: resolve(__dirname, 'src/skill-host/index.ts')
        },
        external: ['uiohook-napi', 'sherpa-onnx-node'],
        output: {
          entryFileNames: '[name].js'
        }
      }
    }
  },
  preload: {
    build: {
      externalizeDeps: {
        exclude: ['zod']
      },
      rollupOptions: {
        input: {
          index: resolve(__dirname, 'src/preload/index.ts')
        },
        output: {
          entryFileNames: '[name].js'
        }
      }
    }
  },
  renderer: {
    root: resolve(__dirname, 'src/renderer'),
    plugins: [vue(), tailwindcss()],
    resolve: {
      alias: {
        '@domains': resolve(__dirname, 'src/domains'),
        '@renderer': resolve(__dirname, 'src/renderer'),
        '@shared': resolve(__dirname, 'src/shared')
      }
    }
  }
})
