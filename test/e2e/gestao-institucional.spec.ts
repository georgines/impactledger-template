/**
 * Testes E2E — Gestão Institucional
 *
 * Caminho feliz:
 *   Pausar INST1 e INST2 via governança.
 *   Despausar INST1 e verificar que volta a operar.
 *   Remover INST2 e INST3 via governança.
 *   Múltiplos pedidos com disputas (INST1 ↔ FORN1): todos os 4 cenários
 *   (forn. abre disputa / inst. abre disputa, cada um vencendo cada vez).
 *
 * Caminhos tristes:
 *   Doador tenta doar para instituição pausada.
 *   Instituição pausada tenta criar pedido.
 *   Carteira removida tenta acessar funções de instituição.
 *   Doador tenta doar para instituição removida.
 */

import { test, expect } from '@playwright/test'
import {
  OPERATOR, DONOR1, DONOR2, DONOR3,
  INST1, INST2, INST3,
  FORN1, FORN2,
  INST1_NAME, INST2_NAME, INST3_NAME,
  FORN1_NAME, FORN1_TYPE, FORN2_NAME, FORN2_TYPE,
  setupPage, loginAs, logout, advanceTime, ADVANCE_WINDOW, donate,
  bootstrap, proposeInstitution, proposeSupplier,
  voteOnFirstProposal, finalizeFirstProposal,
  createOrder, confirmFirstDelivery, submitProof,
  sendEvidence, voteOnDispute, finalizeDispute,
  fullGovernanceSetup, beforeEachReset, makeTmpFile,
  DEADLINE_TEST,
} from './helpers/e2eHelpers'

test.beforeEach(beforeEachReset)

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS LOCAIS
// ─────────────────────────────────────────────────────────────────────────────

async function pauseInstitution(
  page: Parameters<typeof loginAs>[0],
  instAddr: string,
  motivo: string,
  voters: string[],
) {
  await loginAs(page, OPERATOR, 'Cadastrar Instituição')
  await page.getByRole('link', { name: 'Listar Instituições' }).click()
  await page.waitForURL('**/instituicoes')
  await page.locator(`[data-testid="institution-card-${instAddr}"]`).click()
  await page.getByTestId('input-motivo').fill(motivo)
  await page.getByTestId('btn-pausar').click()
  await expect(page.getByTestId('propose-success')).toBeVisible({ timeout: 30_000 })

  for (const voter of voters) {
    await logout(page)
    await loginAs(page, voter, 'Fazer Doação')
    await voteOnFirstProposal(page)
  }
  await advanceTime(page, ADVANCE_WINDOW)
  await logout(page)
  await loginAs(page, OPERATOR, 'Cadastrar Instituição')
  await finalizeFirstProposal(page)
}

async function unpauseInstitution(
  page: Parameters<typeof loginAs>[0],
  instAddr: string,
  motivo: string,
  voters: string[],
) {
  await loginAs(page, OPERATOR, 'Cadastrar Instituição')
  await page.getByRole('link', { name: 'Listar Instituições' }).click()
  await page.waitForURL('**/instituicoes')
  await page.locator(`[data-testid="institution-card-${instAddr}"]`).click()
  await page.getByTestId('input-motivo').fill(motivo)
  await page.getByTestId('btn-despausar').click()
  await expect(page.getByTestId('propose-success')).toBeVisible({ timeout: 30_000 })

  for (const voter of voters) {
    await logout(page)
    await loginAs(page, voter, 'Fazer Doação')
    await voteOnFirstProposal(page)
  }
  await advanceTime(page, ADVANCE_WINDOW)
  await logout(page)
  await loginAs(page, OPERATOR, 'Cadastrar Instituição')
  await finalizeFirstProposal(page)
}

async function removeInstitution(
  page: Parameters<typeof loginAs>[0],
  instAddr: string,
  motivo: string,
  voters: string[],
) {
  await loginAs(page, OPERATOR, 'Cadastrar Instituição')
  await page.getByRole('link', { name: 'Listar Instituições' }).click()
  await page.waitForURL('**/instituicoes')
  await page.locator(`[data-testid="institution-card-${instAddr}"]`).click()
  await page.getByTestId('input-motivo').fill(motivo)
  await page.getByTestId('btn-remover').click()
  await expect(page.getByTestId('propose-success')).toBeVisible({ timeout: 30_000 })

  for (const voter of voters) {
    await logout(page)
    await loginAs(page, voter, 'Fazer Doação')
    await voteOnFirstProposal(page)
  }
  await advanceTime(page, ADVANCE_WINDOW)
  await logout(page)
  await loginAs(page, OPERATOR, 'Cadastrar Instituição')
  await finalizeFirstProposal(page)
}

// ─────────────────────────────────────────────────────────────────────────────
// CAMINHO FELIZ — GESTÃO
// ─────────────────────────────────────────────────────────────────────────────

test('T-GESTAO-HAPPY: pausar, despausar e remover instituições com todos os atores', async ({ page }) => {
  await setupPage(page)
  await fullGovernanceSetup(page)

  // ── Pausa INST1 (DONOR1 + DONOR2 votam) ────────────────────────────────────
  await pauseInstitution(page, INST1, 'Suspeita de irregularidade', [DONOR1, DONOR2])

  // INST1 aparece como pausada na lista
  await page.getByRole('link', { name: 'Listar Instituições' }).click()
  await page.waitForURL('**/instituicoes')
  await expect(page.locator(`[data-testid="institution-card-${INST1}"][data-paused="true"]`)).toBeVisible({ timeout: 15_000 })

  // DONOR1 não vê INST1 em fazer-doacao
  await logout(page)
  await loginAs(page, DONOR1, 'Fazer Doação')
  await page.getByRole('link', { name: 'Fazer Doação' }).click()
  await page.waitForURL('**/fazer-doacao')
  await expect(page.locator(`[data-testid="institution-card-${INST1}"]`)).not.toBeVisible({ timeout: 10_000 })

  // ── Pausa INST2 (DONOR1 + DONOR2 + DONOR3 votam) ──────────────────────────
  await pauseInstitution(page, INST2, 'Auditoria em andamento', [DONOR1, DONOR2, DONOR3])

  // ── Despausa INST1 (DONOR1 + DONOR2 + DONOR3 votam) ──────────────────────
  await unpauseInstitution(page, INST1, 'Auditoria concluída, sem irregularidades', [DONOR1, DONOR2, DONOR3])

  // INST1 volta a aparecer em fazer-doacao
  await logout(page)
  await loginAs(page, DONOR1, 'Fazer Doação')
  await page.getByRole('link', { name: 'Fazer Doação' }).click()
  await page.waitForURL('**/fazer-doacao')
  await expect(page.locator(`[data-testid="institution-card-${INST1}"]`)).toBeVisible({ timeout: 15_000 })

  // INST1 pode criar pedido novamente
  await logout(page)
  await loginAs(page, INST1, 'Novo Pedido')
  await page.getByRole('link', { name: 'Novo Pedido' }).click()
  await page.waitForURL('**/novo-pedido')
  await expect(page.locator(`[data-testid="supplier-card-${FORN1}"]`)).toBeVisible({ timeout: 15_000 })

  // ── Remove INST2 (DONOR1 + DONOR2 + DONOR3 votam) ─────────────────────────
  await removeInstitution(page, INST2, 'Encerramento das atividades', [DONOR1, DONOR2, DONOR3])

  // INST2 some da lista
  await page.getByRole('link', { name: 'Listar Instituições' }).click()
  await page.waitForURL('**/instituicoes')
  await expect(page.locator(`[data-testid="institution-card-${INST2}"]`)).not.toBeVisible({ timeout: 15_000 })

  // DONOR2 não vê mais INST2 em fazer-doacao
  await logout(page)
  await loginAs(page, DONOR2, 'Fazer Doação')
  await page.getByRole('link', { name: 'Fazer Doação' }).click()
  await page.waitForURL('**/fazer-doacao')
  await expect(page.locator(`[data-testid="institution-card-${INST2}"]`)).not.toBeVisible({ timeout: 10_000 })

  // ── Remove INST3 (todos os doadores votam) ────────────────────────────────
  await removeInstitution(page, INST3, 'Fusão com outra entidade', [DONOR1, DONOR2, DONOR3])

  // INST3 some da lista
  await page.getByRole('link', { name: 'Listar Instituições' }).click()
  await page.waitForURL('**/instituicoes')
  await expect(page.locator(`[data-testid="institution-card-${INST3}"]`)).not.toBeVisible({ timeout: 15_000 })

  // INST2 e INST3 não têm mais papel de instituição (vira doador)
  await logout(page)
  await loginAs(page, INST2, 'Fazer Doação')
  await expect(page.getByRole('link', { name: 'Novo Pedido' })).not.toBeVisible()
  await expect(page.getByRole('link', { name: 'Fazer Doação' })).toBeVisible()
})

// ─────────────────────────────────────────────────────────────────────────────
// CAMINHO FELIZ — MÚLTIPLOS PEDIDOS COM DISPUTAS (INST1 ↔ FORN1)
// ─────────────────────────────────────────────────────────────────────────────

test('T-GESTAO-MULTI-DISPUTA: 4 pedidos INST1→FORN1, alternando quem abre disputa e quem vence', async ({ page }) => {
  await setupPage(page)
  await fullGovernanceSetup(page)

  // Doação extra para cobrir 4 pedidos
  await loginAs(page, DONOR1, 'Fazer Doação')
  await page.getByRole('link', { name: 'Fazer Doação' }).click()
  await page.waitForURL('**/fazer-doacao')
  await page.locator(`[data-testid="institution-card-${INST1}"]`).click()
  await page.getByLabel('Valor (ETH)').fill('10')
  await page.getByTestId('btn-confirmar-doacao').click()
  await expect(page.getByTestId('donation-success')).toBeVisible({ timeout: 30_000 })

  // ── Pedido A: FORN1 entrega → INST1 não confirma → FORN1 abre → DONOR1+DONOR2 apoiam forn. ──
  await logout(page)
  await loginAs(page, INST1, 'Novo Pedido')
  await createOrder(page, FORN1, 'Pedido A', 'FORN1 entrega, INST1 não confirma', '1')

  await logout(page)
  await loginAs(page, FORN1, 'Pedidos Recebidos')
  await confirmFirstDelivery(page)
  await advanceTime(page, ADVANCE_WINDOW)
  await page.reload()
  await page.locator('[data-testid^="btn-abrir-disputa-"]').first().click()
  await expect(page.locator('[data-testid^="status-badge-"]').last()).toContainText('Em Disputa', { timeout: 30_000 })
  await sendEvidence(page, 'forn1-prova-A', 'evA-forn.txt')

  await logout(page)
  await loginAs(page, INST1, 'Novo Pedido')
  await sendEvidence(page, 'inst1-contestacao-A', 'evA-inst.txt')

  await logout(page)
  await loginAs(page, DONOR1, 'Fazer Doação')
  await voteOnDispute(page, true)
  await logout(page)
  await loginAs(page, DONOR2, 'Fazer Doação')
  await voteOnDispute(page, true)
  await advanceTime(page, ADVANCE_WINDOW)
  await finalizeDispute(page)

  // ── Pedido B: FORN1 não entrega → INST1 abre → DONOR1+DONOR2 apoiam inst. ──
  await logout(page)
  await loginAs(page, INST1, 'Novo Pedido')
  await createOrder(page, FORN1, 'Pedido B', 'FORN1 não entrega', '1')
  await advanceTime(page, ADVANCE_WINDOW)

  await logout(page)
  await loginAs(page, INST1, 'Novo Pedido')
  await page.getByRole('link', { name: 'Meus Pedidos de Compra' }).click()
  await page.waitForURL('**/pedidos-de-compra')
  await page.locator('[data-testid^="btn-abrir-disputa-"]').first().click()
  await expect(
    page.locator('[data-testid^="status-badge-"]').filter({ hasText: 'Em Disputa' }).first()
  ).toBeVisible({ timeout: 30_000 })
  await sendEvidence(page, 'inst1-prova-B', 'evB-inst.txt')

  await logout(page)
  await loginAs(page, FORN1, 'Pedidos Recebidos')
  await sendEvidence(page, 'forn1-defesa-B', 'evB-forn.txt')

  await logout(page)
  await loginAs(page, DONOR1, 'Fazer Doação')
  await voteOnDispute(page, false)
  await logout(page)
  await loginAs(page, DONOR2, 'Fazer Doação')
  await voteOnDispute(page, false)
  await advanceTime(page, ADVANCE_WINDOW)
  await finalizeDispute(page)

  // ── Pedido C: FORN1 entrega → INST1 não confirma → FORN1 abre → DONOR1+DONOR2+DONOR3 apoiam forn. ──
  await logout(page)
  await loginAs(page, INST1, 'Novo Pedido')
  await createOrder(page, FORN1, 'Pedido C', 'FORN1 entrega, 3 doadores votam', '1')

  await logout(page)
  await loginAs(page, FORN1, 'Pedidos Recebidos')
  await confirmFirstDelivery(page)
  await advanceTime(page, ADVANCE_WINDOW)
  await page.reload()
  await page.locator('[data-testid^="btn-abrir-disputa-"]').first().click()
  await expect(page.locator('[data-testid^="status-badge-"]').last()).toContainText('Em Disputa', { timeout: 30_000 })
  await sendEvidence(page, 'forn1-prova-C', 'evC-forn.txt')

  await logout(page)
  await loginAs(page, INST1, 'Novo Pedido')
  await sendEvidence(page, 'inst1-contestacao-C', 'evC-inst.txt')

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

  // ── Pedido D: FORN1 não entrega → INST1 abre → DONOR1+DONOR2+DONOR3 apoiam inst. ──
  await logout(page)
  await loginAs(page, INST1, 'Novo Pedido')
  await createOrder(page, FORN1, 'Pedido D', 'FORN1 não entrega, 3 doadores votam', '1')
  await advanceTime(page, ADVANCE_WINDOW)

  await logout(page)
  await loginAs(page, INST1, 'Novo Pedido')
  await page.getByRole('link', { name: 'Meus Pedidos de Compra' }).click()
  await page.waitForURL('**/pedidos-de-compra')
  await page.locator('[data-testid^="btn-abrir-disputa-"]').first().click()
  await expect(
    page.locator('[data-testid^="status-badge-"]').filter({ hasText: 'Em Disputa' }).first()
  ).toBeVisible({ timeout: 30_000 })
  await sendEvidence(page, 'inst1-prova-D', 'evD-inst.txt')

  await logout(page)
  await loginAs(page, FORN1, 'Pedidos Recebidos')
  await sendEvidence(page, 'forn1-defesa-D', 'evD-forn.txt')

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

  // INST1 verifica saldo: devoluções dos pedidos B e D aumentaram o saldo disponível
  await logout(page)
  await loginAs(page, INST1, 'Novo Pedido')
  await page.getByRole('link', { name: 'Saldo' }).click()
  await page.waitForURL('**/saldo')
  await expect(page.getByTestId('saldo-disponivel')).toBeVisible({ timeout: 15_000 })

  // FORN1 verifica saldo: pagamentos dos pedidos A e C
  await logout(page)
  await loginAs(page, FORN1, 'Pedidos Recebidos')
  await page.getByRole('link', { name: 'Saldo' }).click()
  await page.waitForURL('**/saldo')
  await expect(page.locator('[data-testid^="payment-row-"]')).toHaveCount(2, { timeout: 15_000 })
})

// ─────────────────────────────────────────────────────────────────────────────
// CAMINHOS TRISTES
// ─────────────────────────────────────────────────────────────────────────────

test('T-GESTAO-SAD-01: doador não consegue doar para instituição pausada', async ({ page }) => {
  await setupPage(page)
  await fullGovernanceSetup(page)

  await pauseInstitution(page, INST1, 'Investigação em curso', [DONOR1, DONOR2])

  await logout(page)
  await loginAs(page, DONOR3, 'Fazer Doação')
  await page.getByRole('link', { name: 'Fazer Doação' }).click()
  await page.waitForURL('**/fazer-doacao')

  // INST1 pausada não deve aparecer na lista
  await expect(page.locator(`[data-testid="institution-card-${INST1}"]`)).not.toBeVisible({ timeout: 10_000 })

  // INST2 e INST3 ainda devem aparecer
  await expect(page.locator(`[data-testid="institution-card-${INST2}"]`)).toBeVisible({ timeout: 10_000 })
  await expect(page.locator(`[data-testid="institution-card-${INST3}"]`)).toBeVisible({ timeout: 10_000 })
})

test('T-GESTAO-SAD-02: instituição pausada não pode criar pedido', async ({ page }) => {
  await setupPage(page)
  await fullGovernanceSetup(page)

  await pauseInstitution(page, INST1, 'Auditoria preventiva', [DONOR1, DONOR2])

  await logout(page)
  await loginAs(page, INST1, 'Novo Pedido')
  await page.getByRole('link', { name: 'Novo Pedido' }).click()
  await page.waitForURL('**/novo-pedido')
  // Página bloqueia instituição pausada antes de mostrar fornecedores
  await expect(page.getByTestId('institution-paused-novo-pedido')).toBeVisible({ timeout: 15_000 })
  await expect(page.locator('[data-testid^="supplier-card-"]')).toHaveCount(0)
})

test('T-GESTAO-SAD-03: doador não consegue doar para instituição removida', async ({ page }) => {
  await setupPage(page)
  await fullGovernanceSetup(page)

  await removeInstitution(page, INST2, 'Encerramento definitivo', [DONOR1, DONOR2, DONOR3])

  await logout(page)
  await loginAs(page, DONOR2, 'Fazer Doação')
  await page.getByRole('link', { name: 'Fazer Doação' }).click()
  await page.waitForURL('**/fazer-doacao')

  // INST2 removida não deve aparecer
  await expect(page.locator(`[data-testid="institution-card-${INST2}"]`)).not.toBeVisible({ timeout: 10_000 })
})

test('T-GESTAO-SAD-04: carteira removida não é mais reconhecida como instituição', async ({ page }) => {
  await setupPage(page)
  await fullGovernanceSetup(page)

  await removeInstitution(page, INST3, 'Encerramento das atividades', [DONOR1, DONOR2, DONOR3])

  // INST3 agora é reconhecida como doador
  await logout(page)
  await loginAs(page, INST3, 'Fazer Doação')

  // Deve ter acesso ao menu de doador, não ao de instituição
  await expect(page.getByRole('link', { name: 'Fazer Doação' })).toBeVisible({ timeout: 10_000 })
  await expect(page.getByRole('link', { name: 'Novo Pedido' })).not.toBeVisible()
  await expect(page.getByRole('link', { name: 'Meus Recebimentos' })).not.toBeVisible()

  // Tentar acessar página de pedidos diretamente deve redirecionar
  await page.goto('/novo-pedido')
  await page.waitForURL('/', { timeout: 10_000 })
})

// ─────────────────────────────────────────────────────────────────────────────
// TC-M1 — Cancelamento de transação exibe mensagem amigável
// ─────────────────────────────────────────────────────────────────────────────

test('T-GESTAO-SAD-05: rejeitar transação exibe mensagem amigável ao usuário', async ({ page }) => {
  await setupPage(page)
  await fullGovernanceSetup(page)
  await loginAs(page, INST1, 'Novo Pedido')
  await page.getByRole('link', { name: 'Novo Pedido' }).click()
  await page.waitForURL('**/novo-pedido')
  await page.locator(`[data-testid="supplier-card-${FORN1}"]`).click()
  await expect(page.getByTestId('modal-novo-pedido')).toBeVisible({ timeout: 10_000 })
  await expect(page.getByTestId('balance-alert')).toBeVisible({ timeout: 10_000 })
  await page.getByTestId('input-title').fill('Material TC-M1')
  await page.getByTestId('input-description').fill('Descrição')
  await page.getByTestId('input-amount').fill('0.1')
  await page.getByTestId('input-deadline').fill(DEADLINE_TEST)
  await page.evaluate(() => { ;(window as Window & { __rejectNextTransaction?: boolean }).__rejectNextTransaction = true })
  await page.getByTestId('btn-criar-pedido').click()
  await expect(page.locator('text=Transação cancelada pelo usuário').first()).toBeVisible({ timeout: 10_000 })
})

test('T-GESTAO-SAD-06: erro técnico de carteira não aparece na tela do usuário', async ({ page }) => {
  await setupPage(page)
  await fullGovernanceSetup(page)
  await loginAs(page, INST1, 'Novo Pedido')
  await page.getByRole('link', { name: 'Novo Pedido' }).click()
  await page.waitForURL('**/novo-pedido')
  await page.locator(`[data-testid="supplier-card-${FORN1}"]`).click()
  await expect(page.getByTestId('modal-novo-pedido')).toBeVisible({ timeout: 10_000 })
  await expect(page.getByTestId('balance-alert')).toBeVisible({ timeout: 10_000 })
  await page.getByTestId('input-title').fill('Material TC-M1-SAD')
  await page.getByTestId('input-description').fill('Descrição')
  await page.getByTestId('input-amount').fill('0.1')
  await page.getByTestId('input-deadline').fill(DEADLINE_TEST)
  await page.evaluate(() => { ;(window as Window & { __rejectNextTransaction?: boolean }).__rejectNextTransaction = true })
  await page.getByTestId('btn-criar-pedido').click()
  await expect(page.getByTestId('order-error')).toBeVisible({ timeout: 10_000 })
  await expect(page.locator('text=user rejected')).toHaveCount(0)
  await expect(page.locator('text=4001')).toHaveCount(0)
  await expect(page.locator('text=ACTION_REJECTED')).toHaveCount(0)
  await expect(page.locator('text=MetaMask')).toHaveCount(0)
})

// ─────────────────────────────────────────────────────────────────────────────
// TC-M3 — Mapa do Bem: nomes + só link da Prova de Impacto
// ─────────────────────────────────────────────────────────────────────────────

test('T-GESTAO-SAD-07: mapa do bem mostra nomes da instituição e fornecedor e link da prova de impacto', async ({ page }) => {
  await setupPage(page)
  await fullGovernanceSetup(page)
  await loginAs(page, INST1, 'Novo Pedido')
  await createOrder(page, FORN1, 'Material TC-M3', 'Descrição', '0.1')
  await logout(page)
  await loginAs(page, FORN1, 'Pedidos Recebidos')
  await confirmFirstDelivery(page)
  await logout(page)
  await loginAs(page, INST1, 'Novo Pedido')
  await submitProof(page, 'prova-m3', 'proof-m3.txt')
  await page.getByRole('link', { name: 'Início' }).click()
  await page.waitForURL('**/inicio')
  await expect(page.locator(`text=${INST1_NAME}`).first()).toBeVisible({ timeout: 15_000 })
  await expect(page.locator(`text=${FORN1_NAME}`).first()).toBeVisible({ timeout: 15_000 })
  await expect(page.locator('text=Prova de Impacto').first()).toBeVisible({ timeout: 15_000 })
})

test('T-GESTAO-SAD-08: mapa do bem não mostra endereços completos nem link de arquivo original', async ({ page }) => {
  await setupPage(page)
  await fullGovernanceSetup(page)
  await loginAs(page, INST1, 'Novo Pedido')
  await createOrder(page, FORN1, 'Material TC-M3-SAD', 'Descrição', '0.1')
  await logout(page)
  await loginAs(page, FORN1, 'Pedidos Recebidos')
  await confirmFirstDelivery(page)
  await logout(page)
  await loginAs(page, INST1, 'Novo Pedido')
  await submitProof(page, 'prova-m3-sad', 'proof-m3-sad.txt')
  await page.getByRole('link', { name: 'Início' }).click()
  await page.waitForURL('**/inicio')
  await expect(page.locator('text=Ver arquivo original')).toHaveCount(0)
  await expect(page.locator(`text=${INST1.toLowerCase()}`)).toHaveCount(0)
  await expect(page.locator(`text=${FORN1.toLowerCase()}`)).toHaveCount(0)
})

// ─────────────────────────────────────────────────────────────────────────────
// TC-M4 — Trocar de carteira sempre volta para a página inicial
// ─────────────────────────────────────────────────────────────────────────────

test('T-GESTAO-SAD-09: trocar de carteira redireciona para página inicial de qualquer tela', async ({ page }) => {
  await setupPage(page)
  await fullGovernanceSetup(page)
  await loginAs(page, INST1, 'Novo Pedido')
  await page.getByRole('link', { name: 'Novo Pedido' }).click()
  await page.waitForURL('**/novo-pedido')
  await page.evaluate((addr: string) => {
    const w = window as Window & { __setEthAccount?: (a: string) => void }
    w.__setEthAccount?.(addr)
  }, DONOR1)
  await page.waitForURL('/', { timeout: 10_000 })
})

test('T-GESTAO-SAD-10: ao desconectar carteira também redireciona para página inicial', async ({ page }) => {
  await setupPage(page)
  await fullGovernanceSetup(page)
  await loginAs(page, DONOR1, 'Fazer Doação')
  await page.getByRole('link', { name: 'Fazer Doação' }).click()
  await page.waitForURL('**/fazer-doacao')
  await page.evaluate(() => {
    const w = window as Window & { __setEthAccount?: (a: string | null) => void }
    w.__setEthAccount?.(null as unknown as string)
  })
  await page.waitForURL('/', { timeout: 10_000 })
})

// ─────────────────────────────────────────────────────────────────────────────
// TC-M5 — Papel do usuário aparece ao lado da carteira no cabeçalho
// ─────────────────────────────────────────────────────────────────────────────

test('T-GESTAO-SAD-11: papel correto aparece no cabeçalho para doador, fornecedor e instituição', async ({ page }) => {
  await setupPage(page)
  await fullGovernanceSetup(page)
  await loginAs(page, DONOR1, 'Fazer Doação')
  await expect(page.locator('text=Você é um doador!').first()).toBeVisible({ timeout: 10_000 })
  await logout(page)
  await loginAs(page, FORN1, 'Pedidos Recebidos')
  await expect(page.locator('text=Você é um fornecedor!').first()).toBeVisible({ timeout: 10_000 })
  await logout(page)
  await loginAs(page, INST1, 'Novo Pedido')
  await expect(page.locator('text=Você é uma instituição!').first()).toBeVisible({ timeout: 10_000 })
})

test('T-GESTAO-SAD-12: operador também tem papel exibido no cabeçalho', async ({ page }) => {
  await setupPage(page)
  await loginAs(page, OPERATOR, 'Cadastrar Instituição')
  await expect(page.locator('text=Você é o operador!').first()).toBeVisible({ timeout: 10_000 })
})
