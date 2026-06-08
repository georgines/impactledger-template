import path from 'path'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    include: ['../test/frontend/**/*.test.{ts,tsx}'],
    setupFiles: ['../test/frontend/setup.ts'],
    css: true,
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@test': path.resolve(__dirname, '../test/frontend'),
      '@deploy-atual': path.resolve(__dirname, './src/deploy/local.json'),
    },
  },
})
