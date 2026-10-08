import { fileURLToPath, URL } from 'node:url'

import vue from '@vitejs/plugin-vue'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  test: {
    // 纯逻辑单测（schema / analysis / validation / template），不依赖 DOM
    environment: 'node',
    include: ['src/**/*.spec.ts'],
  },
})
