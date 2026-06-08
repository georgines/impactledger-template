import path from 'path'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    include: ['test/scripts/**/*.test.ts'],
  },
  resolve: {
    alias: {
      '@scripts': path.resolve(__dirname, './scripts'),
    },
  },
})
