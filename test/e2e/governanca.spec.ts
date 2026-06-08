/**
 * Testes E2E — Governança
 *
 * Caminho feliz:
 *   Bootstrap, aprovação das 3 instituições e 3 fornecedores,
 *   doações de todos os doadores para todas as instituições,
 *   verificação de histórico de doações.
 *
 * Caminhos tristes:
 *   Bootstrap duplicado bloqueado.
 *   Doador tenta votar duas vezes na mesma proposta.
 *   Não-operador não consegue acessar cadastro.
 */

import { test, expect } from '@playwright/test'
import {
  OPERATOR, DONOR1, DONOR2, DONOR3,
  INST1, INST2, INST3,
  FORN1, FORN2, FORN3,
  INST1_NAME, INST1_AREA,
  INST2_NAME, INST2_AREA,
  INST3_NAME, INST3_AREA,
  FORN1_NAME, FORN1_TYPE,
  FORN2_NAME, FORN2_TYPE,
  FORN3_NAME, FORN3_TYPE,
  setupPage, loginAs, logout, advanceTime, ADVANCE_WINDOW, donate,
  bootstrap, proposeInstitution, proposeSupplier,
  voteOnFirstProposal, finalizeFirstProposal,
  fullGovernanceSetup, beforeEachReset,
} from './helpers/e2eHelpers'

test.beforeEach(beforeEachReset)

// ─────────────────────────────────────────────────────────────────────────────
// CAMINHO FELIZ
// ─────────────────────────────────────────────────────────────────────────────

test('T-GOV-HAPPY: governança completa com todos os atores', async ({ page }) => {
  await setupPage(page)

  // ── Bootstrap ──────────────────────────────────────────────────────────────
  await loginAs(page, OPERATOR, 'Cadastrar Instituição')
  await bootstrap(page, INST1, INST1_NAME, INST1_AREA)

  // Verifica INST1 aparece em fazer-doacao
  await page.goto('/fazer-doacao')
  await page.evaluate((addr: string) => {
    const w = window as Window & { __setEthAccount?: (a: string) => void }
    if (w.__setEthAccount) w.__setEthAccount(addr)
  }, OPERATOR)
  await expect(page.locator(`[data-testid="institution-card-${INST1}"]`)).toBeVisible({ timeout: 15_000 })

  // ── DOADOR1 doa para INST1 (peso de voto nas propostas seguintes) ──────────
  await logout(page)
  await donate(page, DONOR1, INST1, '5')
  await logout(page)
  await donate(page, DONOR2, INST1, '3')
  await logout(page)
  await donate(page, DONOR3, INST1, '3')
  await logout(page)

  // ── Propõe e aprova INST2 (DONOR1 + DONOR2 + DONOR3 votam) ────────────────
  await loginAs(page, OPERATOR, 'Cadastrar Instituição')
  await proposeInstitution(page, INST2, INST2_NAME, INST2_AREA)

  await logout(page)
  await loginAs(page, DONOR1, 'Fazer Doação')
  await voteOnFirstProposal(page)

  await logout(page)
  await loginAs(page, DONOR2, 'Fazer Doação')
  await voteOnFirstProposal(page)

  await logout(page)
  await loginAs(page, DONOR3, 'Fazer Doação')
  await voteOnFirstProposal(page)

  await advanceTime(page, ADVANCE_WINDOW)
  await logout(page)
  await loginAs(page, OPERATOR, 'Cadastrar Instituição')
  await finalizeFirstProposal(page)

  // ── Propõe e aprova INST3 (DONOR1 + DONOR2 + DONOR3 votam) ────────────────
  await proposeInstitution(page, INST3, INST3_NAME, INST3_AREA)

  await logout(page)
  await loginAs(page, DONOR1, 'Fazer Doação')
  await voteOnFirstProposal(page)

  await logout(page)
  await loginAs(page, DONOR2, 'Fazer Doação')
  await voteOnFirstProposal(page)

  await logout(page)
  await loginAs(page, DONOR3, 'Fazer Doação')
  await voteOnFirstProposal(page)

  await advanceTime(page, ADVANCE_WINDOW)
  await logout(page)
  await loginAs(page, OPERATOR, 'Cadastrar Instituição')
  await finalizeFirstProposal(page)

  // ── Propõe e aprova FORN1 (DONOR1 + DONOR2 votam) ─────────────────────────
  await proposeSupplier(page, FORN1, FORN1_NAME, FORN1_TYPE)

  await logout(page)
  await loginAs(page, DONOR1, 'Fazer Doação')
  await voteOnFirstProposal(page)

  await logout(page)
  await loginAs(page, DONOR2, 'Fazer Doação')
  await voteOnFirstProposal(page)

  await advanceTime(page, ADVANCE_WINDOW)
  await logout(page)
  await loginAs(page, OPERATOR, 'Cadastrar Instituição')
  await finalizeFirstProposal(page)

  // ── Propõe e aprova FORN2 (DONOR1 + DONOR3 votam) ─────────────────────────
  await proposeSupplier(page, FORN2, FORN2_NAME, FORN2_TYPE)

  await logout(page)
  await loginAs(page, DONOR1, 'Fazer Doação')
  await voteOnFirstProposal(page)

  await logout(page)
  await loginAs(page, DONOR3, 'Fazer Doação')
  await voteOnFirstProposal(page)

  await advanceTime(page, ADVANCE_WINDOW)
  await logout(page)
  await loginAs(page, OPERATOR, 'Cadastrar Instituição')
  await finalizeFirstProposal(page)

  // ── Propõe e aprova FORN3 (DONOR2 + DONOR3 votam) ─────────────────────────
  await proposeSupplier(page, FORN3, FORN3_NAME, FORN3_TYPE)

  await logout(page)
  await loginAs(page, DONOR2, 'Fazer Doação')
  await voteOnFirstProposal(page)

  await logout(page)
  await loginAs(page, DONOR3, 'Fazer Doação')
  await voteOnFirstProposal(page)

  await advanceTime(page, ADVANCE_WINDOW)
  await logout(page)
  await loginAs(page, OPERATOR, 'Cadastrar Instituição')
  await finalizeFirstProposal(page)

  // ── Verifica lista de fornecedores: os 3 aprovados ─────────────────────────
  await page.getByRole('link', { name: 'Listar Fornecedores' }).click()
  await page.waitForURL('**/fornecedores')
  await expect(page.locator(`[data-testid="supplier-card-${FORN1}"]`)).toBeVisible({ timeout: 15_000 })
  await expect(page.locator(`[data-testid="supplier-card-${FORN2}"]`)).toBeVisible({ timeout: 15_000 })
  await expect(page.locator(`[data-testid="supplier-card-${FORN3}"]`)).toBeVisible({ timeout: 15_000 })

  // ── Doações cruzadas: cada doador doa para duas instituições ───────────────
  await logout(page)
  await donate(page, DONOR1, INST2, '4')
  await logout(page)
  await donate(page, DONOR1, INST3, '2')
  await logout(page)
  await donate(page, DONOR2, INST2, '4')
  await logout(page)
  await donate(page, DONOR2, INST3, '3')
  await logout(page)
  await donate(page, DONOR3, INST1, '3')
  await logout(page)
  await donate(page, DONOR3, INST3, '5')
  await logout(page)

  // Verifica histórico de doações: DONOR1
  await loginAs(page, DONOR1, 'Fazer Doação')
  await page.getByRole('link', { name: 'Minhas Doações' }).click()
  await page.waitForURL('**/minhas-doacoes')
  await expect(page.getByTestId('empty-donations')).not.toBeVisible({ timeout: 15_000 })
  await expect(page.locator('.mantine-Badge-root').filter({ hasText: 'ETH' }).first()).toBeVisible()

  // DONOR2 também vê histórico
  await logout(page)
  await loginAs(page, DONOR2, 'Fazer Doação')
  await page.getByRole('link', { name: 'Minhas Doações' }).click()
  await page.waitForURL('**/minhas-doacoes')
  await expect(page.getByTestId('empty-donations')).not.toBeVisible({ timeout: 15_000 })

  // DONOR3 também vê histórico
  await logout(page)
  await loginAs(page, DONOR3, 'Fazer Doação')
  await page.getByRole('link', { name: 'Minhas Doações' }).click()
  await page.waitForURL('**/minhas-doacoes')
  await expect(page.getByTestId('empty-donations')).not.toBeVisible({ timeout: 15_000 })

  // ── Todos os 3 doadores veem as 3 instituições em fazer-doacao ────────────
  await logout(page)
  await loginAs(page, DONOR1, 'Fazer Doação')
  await page.getByRole('link', { name: 'Fazer Doação' }).click()
  await page.waitForURL('**/fazer-doacao')
  await expect(page.locator(`[data-testid="institution-card-${INST1}"]`)).toBeVisible({ timeout: 15_000 })
  await expect(page.locator(`[data-testid="institution-card-${INST2}"]`)).toBeVisible({ timeout: 15_000 })
  await expect(page.locator(`[data-testid="institution-card-${INST3}"]`)).toBeVisible({ timeout: 15_000 })
})

// ─────────────────────────────────────────────────────────────────────────────
// CAMINHOS TRISTES
// ─────────────────────────────────────────────────────────────────────────────

test('T-GOV-SAD-01: bootstrap duplicado é bloqueado', async ({ page }) => {
  await setupPage(page)

  await loginAs(page, OPERATOR, 'Cadastrar Instituição')
  await page.getByRole('link', { name: 'Cadastrar Instituição' }).click()
  await page.waitForURL('**/cadastro/instituicoes')

  // Primeira vez: bootstrap disponível
  await expect(page.getByTestId('bootstrap-section')).toBeVisible({ timeout: 10_000 })

  // Registra primeira instituição
  await page.getByLabel('Endereço').fill(INST1)
  await page.getByLabel('Nome').fill(INST1_NAME)
  await page.getByLabel('Área de Atuação').fill(INST1_AREA)
  await page.getByRole('button', { name: 'Registrar Primeira Instituição' }).click()
  await expect(page.getByTestId('bootstrap-success')).toBeVisible({ timeout: 30_000 })

  // Navega de volta para a mesma página
  await page.getByRole('link', { name: 'Cadastrar Instituição' }).click()
  await page.waitForURL('**/cadastro/instituicoes')

  // Bootstrap não deve mais estar disponível — botão agora diz "Propor"
  await expect(page.getByTestId('bootstrap-section')).not.toBeVisible({ timeout: 10_000 })
  await expect(page.getByRole('button', { name: 'Propor' })).toBeVisible()
})

test('T-GOV-SAD-02: doador tenta votar duas vezes na mesma proposta', async ({ page }) => {
  await setupPage(page)

  // Setup mínimo: bootstrap + doação + proposta
  await loginAs(page, OPERATOR, 'Cadastrar Instituição')
  await bootstrap(page, INST1, INST1_NAME, INST1_AREA)

  await logout(page)
  await donate(page, DONOR1, INST1, '5')
  await logout(page)

  await loginAs(page, OPERATOR, 'Cadastrar Instituição')
  await proposeInstitution(page, INST2, INST2_NAME, INST2_AREA)

  // Primeiro voto: deve funcionar
  await logout(page)
  await loginAs(page, DONOR1, 'Fazer Doação')
  await voteOnFirstProposal(page)

  // Reload força remount do ProposalCard → useVoteStatus re-consulta contrato
  // → hasVoted=true → botão "Votar" some
  await page.reload()
  await page.waitForURL('**/em-votacao')
  await expect(page.getByRole('button', { name: 'Votar' }).first()).not.toBeVisible({ timeout: 15_000 })
})

test('T-GOV-SAD-03: não-operador não vê opções de cadastro', async ({ page }) => {
  await setupPage(page)

  // Setup: bootstrap para DONOR1 existir como doador
  await loginAs(page, OPERATOR, 'Cadastrar Instituição')
  await bootstrap(page, INST1, INST1_NAME, INST1_AREA)
  await logout(page)

  await donate(page, DONOR1, INST1, '1')

  // DONOR1 não deve ver links de cadastro no menu
  await expect(page.getByRole('link', { name: 'Cadastrar Instituição' })).not.toBeVisible()
  await expect(page.getByRole('link', { name: 'Cadastrar Fornecedor' })).not.toBeVisible()
  await expect(page.getByRole('link', { name: 'Listar Fornecedores' })).not.toBeVisible()

  // Tentar acessar diretamente: deve redirecionar ou mostrar bloqueio
  await page.goto('/cadastro/instituicoes')
  await expect(
    page.getByText('Apenas o Operador pode abrir propostas de governança.')
  ).toBeVisible({ timeout: 10_000 })
})

test('T-GOV-SAD-04: doador sem doação não vê botão Votar em propostas', async ({ page }) => {
  await setupPage(page)

  // Bootstrap e cria proposta
  await loginAs(page, OPERATOR, 'Cadastrar Instituição')
  await bootstrap(page, INST1, INST1_NAME, INST1_AREA)
  await logout(page)
  await donate(page, DONOR1, INST1, '5')
  await logout(page)
  await loginAs(page, OPERATOR, 'Cadastrar Instituição')
  await proposeInstitution(page, INST2, INST2_NAME, INST2_AREA)
  await logout(page)

  // DONOR2 nunca doou — não deve ver botão Votar
  await loginAs(page, DONOR2, 'Fazer Doação')
  await page.getByRole('link', { name: 'Propostas em Votação' }).click()
  await page.waitForURL('**/em-votacao')
  await expect(page.getByTestId('empty-proposals')).not.toBeVisible({ timeout: 15_000 })
  await expect(page.getByRole('button', { name: 'Votar' })).not.toBeVisible({ timeout: 5_000 })
})

test('T-GOV-SAD-05: redireciona para landing ao desconectar carteira', async ({ page }) => {
  await setupPage(page)

  await loginAs(page, OPERATOR, 'Cadastrar Instituição')
  await bootstrap(page, INST1, INST1_NAME, INST1_AREA)

  // Está no /inicio — clica em Sair
  await page.getByRole('link', { name: 'Início' }).click()
  await page.waitForURL('**/inicio')
  await page.getByTestId('logout-button').click()
  await page.waitForURL('/', { timeout: 10_000 })
  await expect(page.getByRole('button', { name: /Conectar Carteira/i })).toBeVisible({ timeout: 5_000 })
})

// ─────────────────────────────────────────────────────────────────────────────
// TC-F1 — Renomear ImpactLedger → EloSolidário
// ─────────────────────────────────────────────────────────────────────────────

test('T-GOV-SAD-06: nome EloSolidário aparece no cabeçalho e na aba do navegador', async ({ page }) => {
  await setupPage(page)
  await loginAs(page, OPERATOR, 'Cadastrar Instituição')
  await expect(page.locator('text=EloSolidário').first()).toBeVisible()
  await expect(page).toHaveTitle(/EloSolidário/)
})

test('T-GOV-SAD-07: nenhuma variação de ImpactLedger aparece em nenhuma tela', async ({ page }) => {
  await setupPage(page)
  await loginAs(page, OPERATOR, 'Cadastrar Instituição')
  await expect(page.locator('text=ImpactLedger')).toHaveCount(0)
  await expect(page.locator('text=impactledger')).toHaveCount(0)
  await expect(page.locator('text=IMPACTLEDGER')).toHaveCount(0)
  expect(await page.title()).not.toMatch(/ImpactLedger/i)
})

// ─────────────────────────────────────────────────────────────────────────────
// TC-M2 — Histórico de Votações: apenas 3 labels de resultado
// ─────────────────────────────────────────────────────────────────────────────

test('T-GOV-SAD-08: histórico de votações mostra apenas os 3 labels corretos', async ({ page }) => {
  await setupPage(page)
  await fullGovernanceSetup(page)
  // fullGovernanceSetup já finaliza todas as propostas
  await loginAs(page, DONOR1, 'Fazer Doação')
  await page.getByRole('link', { name: 'Histórico de Votações' }).click()
  await page.waitForURL('**/historico-de-votacoes')
  const labels = page.locator('[data-testid^="proposal-status-"]')
  await expect(labels.first()).toBeVisible({ timeout: 15_000 })
  const count = await labels.count()
  for (let i = 0; i < count; i++) {
    const text = await labels.nth(i).textContent()
    expect(['QUÓRUM NÃO ATINGIDO', 'APROVADA', 'REJEITADA']).toContain(text?.trim())
  }
})

test('T-GOV-SAD-09: label EXECUTADA não aparece no histórico de votações', async ({ page }) => {
  await setupPage(page)
  await fullGovernanceSetup(page)
  await loginAs(page, DONOR1, 'Fazer Doação')
  await page.getByRole('link', { name: 'Histórico de Votações' }).click()
  await page.waitForURL('**/historico-de-votacoes')
  await expect(page.locator('[data-testid^="proposal-status-"]').first()).toBeVisible({ timeout: 15_000 })
  await expect(page.locator('text=EXECUTADA')).toHaveCount(0)
  await expect(page.locator('text=EM ANDAMENTO')).toHaveCount(0)
  await expect(page.locator('text=PENDENTE')).toHaveCount(0)
  await expect(page.locator('text=Approved')).toHaveCount(0)
  await expect(page.locator('text=Rejected')).toHaveCount(0)
})

// ─────────────────────────────────────────────────────────────────────────────
// TC-M6 — Quórum da votação mais visual e fácil de entender
// ─────────────────────────────────────────────────────────────────────────────

test('T-GOV-SAD-10: quórum exibido com barra de progresso e texto de percentual legível', async ({ page }) => {
  await setupPage(page)
  // Setup mínimo: bootstrap + doação + proposta ativa (sem finalizar)
  await loginAs(page, OPERATOR, 'Cadastrar Instituição')
  await bootstrap(page, INST1, INST1_NAME, INST1_AREA)
  await logout(page)
  await donate(page, DONOR1, INST1, '5')
  await logout(page)
  await loginAs(page, OPERATOR, 'Cadastrar Instituição')
  await proposeInstitution(page, INST2, INST2_NAME, INST2_AREA)
  await logout(page)
  await loginAs(page, DONOR1, 'Fazer Doação')
  await page.getByRole('link', { name: 'Propostas em Votação' }).click()
  await page.waitForURL('**/em-votacao')
  const quorumBar = page.locator('[data-testid^="quorum-progress-"]').first()
  await expect(quorumBar).toBeVisible({ timeout: 15_000 })
  // Texto mostra percentual ou "Atingido" — sem números crus em Wei
  await expect(
    page.locator('text=/\\d+% do quórum/').or(page.locator('text=Atingido'))
  ).toBeVisible()
})

test('T-GOV-SAD-11: número bruto de wei não aparece na exibição do quórum', async ({ page }) => {
  await setupPage(page)
  await loginAs(page, OPERATOR, 'Cadastrar Instituição')
  await bootstrap(page, INST1, INST1_NAME, INST1_AREA)
  await logout(page)
  await donate(page, DONOR1, INST1, '5')
  await logout(page)
  await loginAs(page, OPERATOR, 'Cadastrar Instituição')
  await proposeInstitution(page, INST2, INST2_NAME, INST2_AREA)
  await logout(page)
  await loginAs(page, DONOR1, 'Fazer Doação')
  await page.getByRole('link', { name: 'Propostas em Votação' }).click()
  await page.waitForURL('**/em-votacao')
  await expect(page.locator('[data-testid^="quorum-progress-"]').first()).toBeVisible({ timeout: 15_000 })
  const rawWei = page.locator('text=/\\d{15,}/')
  await expect(rawWei).toHaveCount(0)
})
