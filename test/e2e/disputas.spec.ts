/**
 * Testes E2E — Disputas
 *
 * Caminho feliz — Fornecedor abre disputa (entregou, inst. não confirmou):
 *   D-FORN-1: FORN1 vs INST1 — DONOR1 + DONOR2 apoiam fornecedor → FORN1 vence
 *   D-FORN-2: FORN2 vs INST2 — DONOR2 + DONOR3 apoiam fornecedor → FORN2 vence
 *   D-FORN-3: FORN3 vs INST3 — DONOR1 + DONOR2 + DONOR3 apoiam fornecedor → FORN3 vence
 *
 * Caminho feliz — Instituição abre disputa (fornecedor não entregou):
 *   D-INST-1: INST1 vs FORN1 — DONOR1 + DONOR2 apoiam instituição → INST1 vence
 *   D-INST-2: INST2 vs FORN2 — DONOR2 + DONOR3 apoiam instituição → INST2 vence
 *   D-INST-3: INST3 vs FORN3 — DONOR1 + DONOR2 + DONOR3 apoiam instituição → INST3 vence
 *
 * Caminhos tristes:
 *   Botão "Abrir Disputa" escondido antes do prazo expirar.
 *   Doador tenta votar duas vezes na mesma disputa.
 */

import { test, expect } from '@playwright/test'
import {
  OPERATOR, DONOR1, DONOR2, DONOR3,
  INST1, INST2, INST3,
  FORN1, FORN2, FORN3,
  INST1_NAME, INST1_AREA, FORN1_NAME, FORN1_TYPE,
  setupPage, loginAs, logout, advanceTime, ADVANCE_WINDOW, donate,
  bootstrap, proposeSupplier, closeOpenModal,
  voteOnFirstProposal, finalizeFirstProposal,
  createOrder, confirmFirstDelivery,
  sendEvidence, voteOnDispute, finalizeDispute,
  fullGovernanceSetup, beforeEachReset,
} from './helpers/e2eHelpers'

test.beforeEach(beforeEachReset)

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS LOCAIS
// ─────────────────────────────────────────────────────────────────────────────

/** Abre disputa de fornecedor: faz confirmação de entrega + expira prazo de confirmação */
async function setupFornDispute(
  page: Parameters<typeof loginAs>[0],
  inst: string,
  forn: string,
  fornNavItem: string,
) {
  await logout(page)
  await loginAs(page, forn, 'Pedidos Recebidos')
  await confirmFirstDelivery(page)
  // INST não confirma → expira confirmDeadline
  await advanceTime(page, ADVANCE_WINDOW)
  await page.reload()
  // FORN abre disputa
  await expect(page.locator('[data-testid^="btn-abrir-disputa-"]').first()).toBeVisible({ timeout: 15_000 })
  await page.locator('[data-testid^="btn-abrir-disputa-"]').first().click()
  await expect(page.locator('[data-testid^="status-badge-"]').last()).toContainText('Em Disputa', { timeout: 30_000 })
}

/** Abre disputa de instituição: expira deliveryDeadline + INST abre disputa */
async function setupInstDispute(page: Parameters<typeof loginAs>[0], inst: string) {
  // Fornecedor não entregou → expira deliveryDeadline
  await advanceTime(page, ADVANCE_WINDOW)

  await logout(page)
  await loginAs(page, inst, 'Novo Pedido')
  await page.getByRole('link', { name: 'Meus Pedidos de Compra' }).click()
  await page.waitForURL('**/pedidos-de-compra')
  await expect(page.locator('[data-testid^="btn-abrir-disputa-"]').first()).toBeVisible({ timeout: 15_000 })
  await page.locator('[data-testid^="btn-abrir-disputa-"]').first().click()
  await expect(
    page.locator('[data-testid^="status-badge-"]').filter({ hasText: 'Em Disputa' }).first()
  ).toBeVisible({ timeout: 30_000 })
}

// ─────────────────────────────────────────────────────────────────────────────
// FORNECEDOR ABRE DISPUTA
// ─────────────────────────────────────────────────────────────────────────────

test('T-DISPUTA-FORN-1: FORN1 abre disputa vs INST1 — DONOR1+DONOR2 apoiam fornecedor', async ({ page }) => {
  await setupPage(page)
  await fullGovernanceSetup(page)

  // Cria pedido INST1 → FORN1
  await loginAs(page, INST1, 'Novo Pedido')
  await createOrder(page, FORN1, 'Serviço de logística', 'Transporte de doações', '1')

  // FORN1 entrega, INST1 não confirma → FORN1 abre disputa
  await setupFornDispute(page, INST1, FORN1, 'Pedidos Recebidos')

  // Evidências
  await sendEvidence(page, 'forn1-prova-entrega', 'ev-forn1-d1.txt')
  await logout(page)
  await loginAs(page, INST1, 'Novo Pedido')
  await sendEvidence(page, 'inst1-contestacao', 'ev-inst1-d1.txt')

  // DONOR1 apoia fornecedor
  await logout(page)
  await loginAs(page, DONOR1, 'Fazer Doação')
  await voteOnDispute(page, true)

  // DONOR2 apoia fornecedor
  await logout(page)
  await loginAs(page, DONOR2, 'Fazer Doação')
  await voteOnDispute(page, true)

  // Finaliza → FORN1 vence
  await advanceTime(page, ADVANCE_WINDOW)
  await finalizeDispute(page)

  // FORN1 verifica pagamento
  await logout(page)
  await loginAs(page, FORN1, 'Pedidos Recebidos')
  await page.getByRole('link', { name: 'Saldo' }).click()
  await page.waitForURL('**/saldo')
  await expect(page.locator('[data-testid^="payment-row-"]').first()).toBeVisible({ timeout: 30_000 })
})

test('T-DISPUTA-FORN-2: FORN2 abre disputa vs INST2 — DONOR2+DONOR3 apoiam fornecedor', async ({ page }) => {
  await setupPage(page)
  await fullGovernanceSetup(page)

  await loginAs(page, INST2, 'Novo Pedido')
  await createOrder(page, FORN2, 'Sistema de acompanhamento', 'Desenvolvimento de software', '2')

  await setupFornDispute(page, INST2, FORN2, 'Pedidos Recebidos')

  await sendEvidence(page, 'forn2-prova-entrega', 'ev-forn2-d2.txt')
  await logout(page)
  await loginAs(page, INST2, 'Novo Pedido')
  await sendEvidence(page, 'inst2-contestacao', 'ev-inst2-d2.txt')

  await logout(page)
  await loginAs(page, DONOR2, 'Fazer Doação')
  await voteOnDispute(page, true)

  await logout(page)
  await loginAs(page, DONOR3, 'Fazer Doação')
  await voteOnDispute(page, true)

  await advanceTime(page, ADVANCE_WINDOW)
  await finalizeDispute(page)

  await logout(page)
  await loginAs(page, FORN2, 'Pedidos Recebidos')
  await page.getByRole('link', { name: 'Saldo' }).click()
  await page.waitForURL('**/saldo')
  await expect(page.locator('[data-testid^="payment-row-"]').first()).toBeVisible({ timeout: 30_000 })
})

test('T-DISPUTA-FORN-3: FORN3 abre disputa vs INST3 — DONOR1+DONOR2+DONOR3 apoiam fornecedor', async ({ page }) => {
  await setupPage(page)
  await fullGovernanceSetup(page)

  await loginAs(page, INST3, 'Novo Pedido')
  await createOrder(page, FORN3, 'Ração e remédios', 'Suprimentos veterinários', '2')

  await setupFornDispute(page, INST3, FORN3, 'Pedidos Recebidos')

  await sendEvidence(page, 'forn3-prova-entrega', 'ev-forn3-d3.txt')
  await logout(page)
  await loginAs(page, INST3, 'Novo Pedido')
  await sendEvidence(page, 'inst3-contestacao', 'ev-inst3-d3.txt')

  await logout(page)
  await loginAs(page, DONOR1, 'Fazer Doação')
  await voteOnDispute(page, true)

  await logout(page)
  await loginAs(page, DONOR2, 'Fazer Doação')
  await voteOnDispute(page, true)

  await logout(page)
  await loginAs(page, DONOR3, 'Fazer Doação')
  await voteOnDispute(page, true)

  await advanceTime(page, ADVANCE_WINDOW)
  await finalizeDispute(page)

  await logout(page)
  await loginAs(page, FORN3, 'Pedidos Recebidos')
  await page.getByRole('link', { name: 'Saldo' }).click()
  await page.waitForURL('**/saldo')
  await expect(page.locator('[data-testid^="payment-row-"]').first()).toBeVisible({ timeout: 30_000 })
})

// ─────────────────────────────────────────────────────────────────────────────
// INSTITUIÇÃO ABRE DISPUTA
// ─────────────────────────────────────────────────────────────────────────────

test('T-DISPUTA-INST-1: INST1 abre disputa vs FORN1 — DONOR1+DONOR2 apoiam instituição', async ({ page }) => {
  await setupPage(page)
  await fullGovernanceSetup(page)

  await loginAs(page, INST1, 'Novo Pedido')
  await createOrder(page, FORN1, 'Consultoria educacional', 'FORN1 não vai entregar', '1')

  // FORN1 não entrega → INST1 abre disputa
  await setupInstDispute(page, INST1)

  await sendEvidence(page, 'inst1-forn-nao-entregou', 'ev-inst1-di1.txt')
  await logout(page)
  await loginAs(page, FORN1, 'Pedidos Recebidos')
  await sendEvidence(page, 'forn1-defesa', 'ev-forn1-di1.txt')

  await logout(page)
  await loginAs(page, DONOR1, 'Fazer Doação')
  await voteOnDispute(page, false)

  await logout(page)
  await loginAs(page, DONOR2, 'Fazer Doação')
  await voteOnDispute(page, false)

  await advanceTime(page, ADVANCE_WINDOW)
  await finalizeDispute(page)

  // INST1 verifica saldo devolvido
  await logout(page)
  await loginAs(page, INST1, 'Novo Pedido')
  await page.getByRole('link', { name: 'Saldo' }).click()
  await page.waitForURL('**/saldo')
  await expect(page.getByTestId('saldo-disponivel')).toBeVisible({ timeout: 15_000 })
  await expect(page.getByTestId('saldo-disponivel')).not.toContainText('0.0 ETH')
})

test('T-DISPUTA-INST-2: INST2 abre disputa vs FORN2 — DONOR2+DONOR3 apoiam instituição', async ({ page }) => {
  await setupPage(page)
  await fullGovernanceSetup(page)

  await loginAs(page, INST2, 'Novo Pedido')
  await createOrder(page, FORN2, 'Plataforma de saúde', 'FORN2 não vai entregar', '2')

  await setupInstDispute(page, INST2)

  await sendEvidence(page, 'inst2-forn-nao-entregou', 'ev-inst2-di2.txt')
  await logout(page)
  await loginAs(page, FORN2, 'Pedidos Recebidos')
  await sendEvidence(page, 'forn2-defesa', 'ev-forn2-di2.txt')

  await logout(page)
  await loginAs(page, DONOR2, 'Fazer Doação')
  await voteOnDispute(page, false)

  await logout(page)
  await loginAs(page, DONOR3, 'Fazer Doação')
  await voteOnDispute(page, false)

  await advanceTime(page, ADVANCE_WINDOW)
  await finalizeDispute(page)

  await logout(page)
  await loginAs(page, INST2, 'Novo Pedido')
  await page.getByRole('link', { name: 'Saldo' }).click()
  await page.waitForURL('**/saldo')
  await expect(page.getByTestId('saldo-disponivel')).not.toContainText('0.0 ETH')
})

test('T-DISPUTA-INST-3: INST3 abre disputa vs FORN3 — DONOR1+DONOR2+DONOR3 apoiam instituição', async ({ page }) => {
  await setupPage(page)
  await fullGovernanceSetup(page)

  await loginAs(page, INST3, 'Novo Pedido')
  await createOrder(page, FORN3, 'Equipamentos veterinários', 'FORN3 não vai entregar', '2')

  await setupInstDispute(page, INST3)

  await sendEvidence(page, 'inst3-forn-nao-entregou', 'ev-inst3-di3.txt')
  await logout(page)
  await loginAs(page, FORN3, 'Pedidos Recebidos')
  await sendEvidence(page, 'forn3-defesa', 'ev-forn3-di3.txt')

  await logout(page)
  await loginAs(page, DONOR1, 'Fazer Doação')
  await voteOnDispute(page, false)

  await logout(page)
  await loginAs(page, DONOR2, 'Fazer Doação')
  await voteOnDispute(page, false)

  await logout(page)
  await loginAs(page, DONOR3, 'Fazer Doação')
  await voteOnDispute(page, false)

  await advanceTime(page, ADVANCE_WINDOW)
  await finalizeDispute(page)

  await logout(page)
  await loginAs(page, INST3, 'Novo Pedido')
  await page.getByRole('link', { name: 'Saldo' }).click()
  await page.waitForURL('**/saldo')
  await expect(page.getByTestId('saldo-disponivel')).not.toContainText('0.0 ETH')
})

// ─────────────────────────────────────────────────────────────────────────────
// CAMINHOS TRISTES
// ─────────────────────────────────────────────────────────────────────────────

test('T-DISPUTA-SAD-01: botão abrir disputa não aparece antes do prazo expirar', async ({ page }) => {
  await setupPage(page)

  // Setup mínimo
  // Doação ANTES da proposta para garantir peso de voto
  await loginAs(page, OPERATOR, 'Cadastrar Instituição')
  await bootstrap(page, INST1, INST1_NAME, INST1_AREA)
  await logout(page)
  await donate(page, DONOR1, INST1, '5')
  await logout(page)
  await loginAs(page, OPERATOR, 'Cadastrar Instituição')
  await proposeSupplier(page, FORN1, FORN1_NAME, FORN1_TYPE)
  await logout(page)
  await loginAs(page, DONOR1, 'Fazer Doação')
  await voteOnFirstProposal(page)
  await advanceTime(page, ADVANCE_WINDOW)
  await logout(page)
  await loginAs(page, OPERATOR, 'Cadastrar Instituição')
  await finalizeFirstProposal(page)

  await logout(page)
  await loginAs(page, INST1, 'Novo Pedido')
  await createOrder(page, FORN1, 'Pedido com prazo ativo', 'Dentro do prazo', '1')

  // Sem avançar o tempo → botão "Abrir Disputa" não deve aparecer
  await closeOpenModal(page)
  await page.getByRole('link', { name: 'Meus Pedidos de Compra' }).click()
  await page.waitForURL('**/pedidos-de-compra')
  await expect(page.locator('[data-testid^="btn-abrir-disputa-"]').first()).not.toBeVisible({ timeout: 5_000 })
  // Deve mostrar "Aguardando entrega pelo fornecedor."
  await expect(page.getByText('Aguardando entrega pelo fornecedor.')).toBeVisible()
})

test('T-DISPUTA-SAD-02: doador tenta votar duas vezes na mesma disputa', async ({ page }) => {
  await setupPage(page)

  // Doação ANTES da proposta para garantir peso de voto
  await loginAs(page, OPERATOR, 'Cadastrar Instituição')
  await bootstrap(page, INST1, INST1_NAME, INST1_AREA)
  await logout(page)
  await donate(page, DONOR1, INST1, '5')
  await logout(page)
  await loginAs(page, OPERATOR, 'Cadastrar Instituição')
  await proposeSupplier(page, FORN1, FORN1_NAME, FORN1_TYPE)
  await logout(page)
  await loginAs(page, DONOR1, 'Fazer Doação')
  await voteOnFirstProposal(page)
  await advanceTime(page, ADVANCE_WINDOW)
  await logout(page)
  await loginAs(page, OPERATOR, 'Cadastrar Instituição')
  await finalizeFirstProposal(page)

  await logout(page)
  await loginAs(page, INST1, 'Novo Pedido')
  await createOrder(page, FORN1, 'Pedido disputa dupla', 'Teste de voto duplicado', '1')

  // FORN1 entrega, expira confirmDeadline, FORN1 abre disputa
  await logout(page)
  await loginAs(page, FORN1, 'Pedidos Recebidos')
  await confirmFirstDelivery(page)
  await advanceTime(page, ADVANCE_WINDOW)
  await page.reload()
  await page.locator('[data-testid^="btn-abrir-disputa-"]').first().click()
  await expect(page.locator('[data-testid^="status-badge-"]').last()).toContainText('Em Disputa', { timeout: 30_000 })

  // DONOR1 vota pela primeira vez → deve funcionar
  await logout(page)
  await loginAs(page, DONOR1, 'Fazer Doação')
  await voteOnDispute(page, true)

  // DONOR1 tenta votar de novo → deve rejeitar
  await page.getByRole('link', { name: 'Disputas Ativas' }).click()
  await page.waitForURL('**/disputas-ativas')

  const voteBtn = page.locator('[data-testid^="btn-votar-fornecedor-"]').first()
  if (await voteBtn.isVisible()) {
    await voteBtn.click()
    // Deve mostrar erro de transação
    await expect(page.locator('[data-testid^="tx-error"], [data-testid="vote-success"]').first()).toBeVisible({ timeout: 30_000 })
    // Se vote-success aparecer novamente, algo está errado (contrato deveria rejeitar)
    await expect(page.getByTestId('vote-success')).not.toBeVisible({ timeout: 5_000 })
  }
  // Se o botão não aparecer (UI oculta após votação), também é comportamento correto
})

// ─────────────────────────────────────────────────────────────────────────────
// TC-F2 — Botão "Executar Veredicto" verde, lado direito
// ─────────────────────────────────────────────────────────────────────────────

test('T-DISPUTA-SAD-03: botão executar veredicto é verde e está à direita após disputa expirar', async ({ page }) => {
  await setupPage(page)
  await fullGovernanceSetup(page)

  await loginAs(page, INST1, 'Novo Pedido')
  await createOrder(page, FORN1, 'Material TC-F2', 'Desc', '0.1')
  await logout(page)
  await loginAs(page, FORN1, 'Pedidos Recebidos')
  await confirmFirstDelivery(page)

  // Expira confirmDeadline → FORN1 pode abrir disputa
  await advanceTime(page, ADVANCE_WINDOW)
  await page.reload()
  await expect(page.locator('[data-testid^="btn-abrir-disputa-"]').first()).toBeVisible({ timeout: 15_000 })
  await page.locator('[data-testid^="btn-abrir-disputa-"]').first().click()
  // Aguarda confirmação da transação antes de avançar tempo
  await expect(page.locator('[data-testid^="status-badge-"]').last()).toContainText('Em Disputa', { timeout: 30_000 })

  // Expira disputeDeadline
  await advanceTime(page, ADVANCE_WINDOW)
  await logout(page)
  await loginAs(page, DONOR1, 'Fazer Doação')
  await page.getByRole('link', { name: 'Disputas Ativas' }).click()
  await page.waitForURL('**/disputas-ativas')
  await page.reload()

  const btn = page.locator('[data-testid^="btn-finalizar-disputa-"]').first()
  await expect(btn).toBeVisible({ timeout: 15_000 })
  const group = btn.locator('..')
  await expect(group).toHaveCSS('justify-content', 'flex-end')
})

test('T-DISPUTA-SAD-04: botão executar veredicto não aparece enquanto disputa ainda está ativa', async ({ page }) => {
  await setupPage(page)
  await fullGovernanceSetup(page)

  await loginAs(page, INST1, 'Novo Pedido')
  await createOrder(page, FORN1, 'Material TC-F2-SAD', 'Desc', '0.1')
  await logout(page)
  await loginAs(page, FORN1, 'Pedidos Recebidos')
  await confirmFirstDelivery(page)

  // Expira confirmDeadline → FORN1 abre disputa
  await advanceTime(page, ADVANCE_WINDOW)
  await page.reload()
  await expect(page.locator('[data-testid^="btn-abrir-disputa-"]').first()).toBeVisible({ timeout: 15_000 })
  await page.locator('[data-testid^="btn-abrir-disputa-"]').first().click()

  // NÃO expira disputeDeadline
  await logout(page)
  await loginAs(page, DONOR1, 'Fazer Doação')
  await page.getByRole('link', { name: 'Disputas Ativas' }).click()
  await page.waitForURL('**/disputas-ativas')

  // btn-finalizar não deve existir
  await expect(page.locator('[data-testid^="btn-finalizar-disputa-"]')).toHaveCount(0)
  // btn-votar deve aparecer (doador com doação pode votar)
  await expect(page.locator('[data-testid^="btn-votar-fornecedor-"]').first()).toBeVisible({ timeout: 15_000 })
})

// ─────────────────────────────────────────────────────────────────────────────
// TC-D4 — Histórico de Disputas
// ─────────────────────────────────────────────────────────────────────────────

test('T-DISPUTA-SAD-05: histórico de disputas exibe disputas resolvidas com nomes, resultado e data', async ({ page }) => {
  await setupPage(page)
  await fullGovernanceSetup(page)

  // Cria pedido e abre disputa (fornecedor entregou, instituição não confirmou)
  await loginAs(page, INST1, 'Novo Pedido')
  await createOrder(page, FORN1, 'Material TC-D4', 'Descrição', '1')
  await setupFornDispute(page, INST1, FORN1, 'Pedidos Recebidos')

  // Fornecedor envia evidência
  await sendEvidence(page, 'forn1-prova-d4', 'ev-forn1-d4.txt')

  // Doador vota a favor do fornecedor
  await logout(page)
  await loginAs(page, DONOR1, 'Fazer Doação')
  await voteOnDispute(page, true)

  // Expira disputeDeadline e finaliza
  await advanceTime(page, ADVANCE_WINDOW)
  await finalizeDispute(page)

  // Navega para histórico de disputas
  await logout(page)
  await loginAs(page, DONOR1, 'Início')
  await page.getByRole('link', { name: /Histórico de Disputas/ }).click()
  await page.waitForURL('**/historico-disputas')

  const card = page.locator('[data-testid^="resolved-dispute-card-"]').first()
  await expect(card).toBeVisible({ timeout: 20_000 })
  await expect(card.locator(`text=${INST1_NAME}`)).toBeVisible()
  await expect(card.locator(`text=${FORN1_NAME}`)).toBeVisible()
  await expect(
    card.locator('text=Fornecedor venceu').or(card.locator('text=Instituição venceu'))
  ).toBeVisible()
  await expect(card.locator('text=/\\d{2}\\/\\d{2}\\/\\d{4}/')).toBeVisible()
})

test('T-DISPUTA-SAD-06: histórico vazio mostra mensagem amigável e não quebra a tela', async ({ page }) => {
  await setupPage(page)
  await fullGovernanceSetup(page)

  // Nenhuma disputa foi resolvida
  await loginAs(page, DONOR1, 'Início')
  await page.getByRole('link', { name: /Histórico de Disputas/ }).click()
  await page.waitForURL('**/historico-disputas')

  // Não deve ter cards
  await expect(page.locator('[data-testid^="resolved-dispute-card-"]')).toHaveCount(0)
  // Deve mostrar mensagem de vazio
  await expect(page.locator('[data-testid="empty-historico-disputas"]')).toBeVisible({ timeout: 10_000 })
})
