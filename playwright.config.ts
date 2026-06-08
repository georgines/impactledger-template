import { defineConfig } from '@playwright/test'

/**
 * Playwright E2E config para o EloSolidário.
 *
 * Pré-requisitos antes de executar os testes:
 *
 *   Terminal 1 (blockchain local):
 *     anvil --block-time 1
 *
 *   Terminal 2 (contratos):
 *     yarn deploy:local
 *
 *   Terminal 3 (frontend):
 *     yarn dev
 *
 *   Terminal 4 (testes):
 *     yarn test:e2e
 *
 * O globalSetup faz o anvil_reset + deploy automaticamente se os contratos
 * não estiverem no estado limpo (sem bootstrap).
 */
export default defineConfig({
  testDir: './test/e2e',
  timeout: 600_000,
  expect: { timeout: 30_000 },
  fullyParallel: false,
  workers: 1,
  reporter: 'list',
  globalSetup: './test/e2e/globalSetup.ts',
  globalTeardown: './test/e2e/globalTeardown.ts',
  use: {
    baseURL: 'http://localhost:3000',
    headless: true,
    video: 'off',
    screenshot: 'only-on-failure',
    trace: 'off',
    actionTimeout: 30_000,
    navigationTimeout: 30_000,
    channel: 'chrome',
  },
})
