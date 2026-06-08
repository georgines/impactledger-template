/**
 * Testes E2E — Ciclo Completo de Pedido
 *
 * Caminho feliz:
 *   6 pedidos com pares de instituição/fornecedor diferentes.
 *   Cada pedido percorre: criar → fornecedor confirma entrega →
 *   instituição confirma recebimento + Proof of Impact → pagamento liberado.
 *
 * Caminhos tristes:
 *   Pedido sem saldo suficiente.
 *   Pedido quando não há fornecedores aprovados.
 *   Botão de enviar prova desabilitado sem arquivo selecionado.
 *   Instituição pausada não pode criar pedido.
 */

import { test, expect } from '@playwright/test'
import {
  OPERATOR, DONOR1, DONOR2, DONOR3,
  INST1, INST2, INST3,
  FORN1, FORN2, FORN3,
  INST1_NAME, INST1_AREA,
  INST2_NAME, INST2_AREA,
  FORN1_NAME, FORN1_TYPE, FORN2_NAME, FORN3_NAME,
  setupPage, loginAs, logout, advanceTime, ADVANCE_WINDOW, donate,
  bootstrap, proposeInstitution, proposeSupplier,
  voteOnFirstProposal, finalizeFirstProposal,
  createOrder, confirmFirstDelivery, submitProof,
  fullGovernanceSetup, beforeEachReset,
} from './helpers/e2eHelpers'

test.beforeEach(beforeEachReset)

// ─────────────────────────────────────────────────────────────────────────────
// CAMINHO FELIZ
// ─────────────────────────────────────────────────────────────────────────────

test('T-PEDIDO-HAPPY: 6 pedidos com ciclo completo — todos os pares inst/forn', async ({ page }) => {
  await setupPage(page)
  await fullGovernanceSetup(page)

  // ── Pedido 1: INST1 → FORN1 (1 ETH) ───────────────────────────────────────
  await loginAs(page, INST1, 'Novo Pedido')
  await createOrder(page, FORN1, 'Equipamentos médicos', 'Kit de primeiros socorros para o instituto', '1')

  await logout(page)
  await loginAs(page, FORN1, 'Pedidos Recebidos')
  await confirmFirstDelivery(page)

  await logout(page)
  await loginAs(page, INST1, 'Novo Pedido')
  await submitProof(page, 'prova-impacto-p1', 'proof-p1.txt')

  // FORN1 verifica pagamento recebido
  await logout(page)
  await loginAs(page, FORN1, 'Pedidos Recebidos')
  await page.getByRole('link', { name: 'Saldo' }).click()
  await page.waitForURL('**/saldo')
  await expect(page.getByTestId('historico-recebimentos')).toBeVisible({ timeout: 15_000 })
  await expect(page.locator('[data-testid^="payment-row-"]').first()).toBeVisible({ timeout: 30_000 })

  // ── Pedido 2: INST1 → FORN2 (2 ETH) ───────────────────────────────────────
  await logout(page)
  await loginAs(page, INST1, 'Novo Pedido')
  await createOrder(page, FORN2, 'Software de gestão', 'Sistema de gestão de voluntários', '2')

  await logout(page)
  await loginAs(page, FORN2, 'Pedidos Recebidos')
  await confirmFirstDelivery(page)

  await logout(page)
  await loginAs(page, INST1, 'Novo Pedido')
  await submitProof(page, 'prova-impacto-p2', 'proof-p2.txt')

  await logout(page)
  await loginAs(page, FORN2, 'Pedidos Recebidos')
  await page.getByRole('link', { name: 'Saldo' }).click()
  await page.waitForURL('**/saldo')
  await expect(page.locator('[data-testid^="payment-row-"]').first()).toBeVisible({ timeout: 30_000 })

  // ── Pedido 3: INST2 → FORN1 (1.5 ETH) ────────────────────────────────────
  await logout(page)
  await loginAs(page, INST2, 'Novo Pedido')
  await createOrder(page, FORN1, 'Insumos hospitalares', 'Luvas e máscaras descartáveis', '1.5')

  await logout(page)
  await loginAs(page, FORN1, 'Pedidos Recebidos')
  await confirmFirstDelivery(page)

  await logout(page)
  await loginAs(page, INST2, 'Novo Pedido')
  await submitProof(page, 'prova-impacto-p3', 'proof-p3.txt')

  await logout(page)
  await loginAs(page, FORN1, 'Pedidos Recebidos')
  await page.getByRole('link', { name: 'Saldo' }).click()
  await page.waitForURL('**/saldo')
  await expect(page.locator('[data-testid^="payment-row-"]').first()).toBeVisible({ timeout: 30_000 })

  // ── Pedido 4: INST2 → FORN3 (1 ETH) ──────────────────────────────────────
  await logout(page)
  await loginAs(page, INST2, 'Novo Pedido')
  await createOrder(page, FORN3, 'Medicamentos veterinários', 'Vacinas e antiparasitários', '1')

  await logout(page)
  await loginAs(page, FORN3, 'Pedidos Recebidos')
  await confirmFirstDelivery(page)

  await logout(page)
  await loginAs(page, INST2, 'Novo Pedido')
  await submitProof(page, 'prova-impacto-p4', 'proof-p4.txt')

  await logout(page)
  await loginAs(page, FORN3, 'Pedidos Recebidos')
  await page.getByRole('link', { name: 'Saldo' }).click()
  await page.waitForURL('**/saldo')
  await expect(page.locator('[data-testid^="payment-row-"]').first()).toBeVisible({ timeout: 30_000 })

  // ── Pedido 5: INST3 → FORN2 (2 ETH) ──────────────────────────────────────
  await logout(page)
  await loginAs(page, INST3, 'Novo Pedido')
  await createOrder(page, FORN2, 'Sistema de adoção', 'Plataforma digital para adoção de animais', '2')

  await logout(page)
  await loginAs(page, FORN2, 'Pedidos Recebidos')
  await confirmFirstDelivery(page)

  await logout(page)
  await loginAs(page, INST3, 'Novo Pedido')
  await submitProof(page, 'prova-impacto-p5', 'proof-p5.txt')

  await logout(page)
  await loginAs(page, FORN2, 'Pedidos Recebidos')
  await page.getByRole('link', { name: 'Saldo' }).click()
  await page.waitForURL('**/saldo')
  await expect(page.locator('[data-testid^="payment-row-"]').first()).toBeVisible({ timeout: 30_000 })

  // ── Pedido 6: INST3 → FORN3 (1.5 ETH) ────────────────────────────────────
  await logout(page)
  await loginAs(page, INST3, 'Novo Pedido')
  await createOrder(page, FORN3, 'Ração especial', 'Ração premium para animais resgatados', '1.5')

  await logout(page)
  await loginAs(page, FORN3, 'Pedidos Recebidos')
  await confirmFirstDelivery(page)

  await logout(page)
  await loginAs(page, INST3, 'Novo Pedido')
  await submitProof(page, 'prova-impacto-p6', 'proof-p6.txt')

  await logout(page)
  await loginAs(page, FORN3, 'Pedidos Recebidos')
  await page.getByRole('link', { name: 'Saldo' }).click()
  await page.waitForURL('**/saldo')
  await expect(page.locator('[data-testid^="payment-row-"]').first()).toBeVisible({ timeout: 30_000 })

  // ── Verifica saldo de cada fornecedor tem múltiplos pagamentos ────────────
  await logout(page)
  await loginAs(page, FORN1, 'Pedidos Recebidos')
  await page.getByRole('link', { name: 'Saldo' }).click()
  await page.waitForURL('**/saldo')
  // FORN1 deve ter pelo menos 2 linhas de pagamento (pedidos 1 e 3)
  await expect(page.locator('[data-testid^="payment-row-"]')).toHaveCount(2, { timeout: 15_000 })
})

// ─────────────────────────────────────────────────────────────────────────────
// CAMINHOS TRISTES
// ─────────────────────────────────────────────────────────────────────────────

test('T-PEDIDO-SAD-01: pedido com valor maior que saldo disponível é rejeitado', async ({ page }) => {
  await setupPage(page)

  // Doação ANTES da proposta para garantir peso de voto
  await loginAs(page, OPERATOR, 'Cadastrar Instituição')
  await bootstrap(page, INST1, INST1_NAME, INST1_AREA)
  await logout(page)
  await donate(page, DONOR1, INST1, '1')
  await logout(page)

  // Aprova FORN1 — DONOR1 já tem peso de voto
  await loginAs(page, OPERATOR, 'Cadastrar Instituição')
  await proposeSupplier(page, FORN1, FORN1_NAME, FORN1_TYPE)
  await logout(page)
  await loginAs(page, DONOR1, 'Fazer Doação')
  await voteOnFirstProposal(page)
  await advanceTime(page, ADVANCE_WINDOW)
  await logout(page)
  await loginAs(page, OPERATOR, 'Cadastrar Instituição')
  await finalizeFirstProposal(page)

  // INST1 tem 1 ETH de saldo. Tenta criar pedido de 5 ETH → deve rejeitar
  await logout(page)
  await loginAs(page, INST1, 'Novo Pedido')
  await page.getByRole('link', { name: 'Novo Pedido' }).click()
  await page.waitForURL('**/novo-pedido')
  await page.locator(`[data-testid="supplier-card-${FORN1}"]`).click()
  await expect(page.getByTestId('modal-novo-pedido')).toBeVisible({ timeout: 10_000 })
  await page.getByTestId('input-title').fill('Pedido acima do saldo')
  await page.getByTestId('input-description').fill('Valor excede saldo disponível')
  await page.getByTestId('input-deadline').fill('90')
  await page.getByTestId('input-amount').fill('5')

  // UI valida localmente: amount (5 ETH) > saldo disponível (1 ETH) → botão desabilitado
  await expect(page.getByTestId('btn-criar-pedido')).toBeDisabled({ timeout: 10_000 })

  // Nenhum pedido criado
  await page.keyboard.press('Escape')
  await page.getByRole('link', { name: 'Meus Pedidos de Compra' }).click()
  await page.waitForURL('**/pedidos-de-compra')
  await expect(page.getByTestId('empty-orders')).toBeVisible({ timeout: 10_000 })
})

test('T-PEDIDO-SAD-02: sem fornecedores aprovados a página de novo pedido fica vazia', async ({ page }) => {
  await setupPage(page)

  // Setup mínimo: só bootstrap + doação (sem aprovar fornecedor)
  await loginAs(page, OPERATOR, 'Cadastrar Instituição')
  await bootstrap(page, INST1, INST1_NAME, INST1_AREA)
  await logout(page)
  await donate(page, DONOR1, INST1, '5')

  // INST1 acessa novo pedido — nenhum fornecedor aprovado
  await logout(page)
  await loginAs(page, INST1, 'Novo Pedido')
  await page.getByRole('link', { name: 'Novo Pedido' }).click()
  await page.waitForURL('**/novo-pedido')

  // Lista de fornecedores deve estar vazia
  await expect(page.getByTestId('empty-suppliers')).toBeVisible({ timeout: 15_000 })
})

test('T-PEDIDO-SAD-03: botão de enviar prova fica desabilitado sem arquivo selecionado', async ({ page }) => {
  await setupPage(page)

  // Doação ANTES da proposta
  await loginAs(page, OPERATOR, 'Cadastrar Instituição')
  await bootstrap(page, INST1, INST1_NAME, INST1_AREA)
  await logout(page)
  await donate(page, DONOR1, INST1, '3')
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

  // Cria pedido
  await logout(page)
  await loginAs(page, INST1, 'Novo Pedido')
  await createOrder(page, FORN1, 'Pedido prova', 'Teste de desabilitação do botão de prova', '1')

  // FORN1 confirma entrega
  await logout(page)
  await loginAs(page, FORN1, 'Pedidos Recebidos')
  await confirmFirstDelivery(page)

  // INST1 acessa meus-recebimentos sem selecionar arquivo
  await logout(page)
  await loginAs(page, INST1, 'Novo Pedido')
  await page.getByRole('link', { name: 'Meus Recebimentos' }).click()
  await page.waitForURL('**/meus-recebimentos')
  await expect(page.getByTestId('section-aguardando-proof')).toBeVisible({ timeout: 15_000 })

  // Botão deve estar desabilitado sem arquivo
  const submitBtn = page.locator('[data-testid^="btn-confirmar-"]').first()
  await expect(submitBtn).toBeDisabled({ timeout: 10_000 })
})

test('T-PEDIDO-SAD-04: instituição pausada não consegue criar pedido', async ({ page }) => {
  await setupPage(page)

  // Doação ANTES da proposta
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

  // Pausa INST1 via governance
  await page.getByRole('link', { name: 'Listar Instituições' }).click()
  await page.waitForURL('**/instituicoes')
  await page.locator(`[data-testid="institution-card-${INST1}"]`).click()
  await page.getByTestId('input-motivo').fill('Irregularidade detectada')
  await page.getByTestId('btn-pausar').click()
  await expect(page.getByTestId('propose-success')).toBeVisible({ timeout: 30_000 })

  await logout(page)
  await loginAs(page, DONOR1, 'Fazer Doação')
  await voteOnFirstProposal(page)
  await advanceTime(page, ADVANCE_WINDOW)
  await logout(page)
  await loginAs(page, OPERATOR, 'Cadastrar Instituição')
  await finalizeFirstProposal(page)

  // INST1 tenta criar pedido — frontend bloqueia com alerta de pausa
  await logout(page)
  await loginAs(page, INST1, 'Novo Pedido')
  await page.getByRole('link', { name: 'Novo Pedido' }).click()
  await page.waitForURL('**/novo-pedido')
  await expect(page.getByTestId('institution-paused-novo-pedido')).toBeVisible({ timeout: 15_000 })
  // Confirma que os cards de fornecedor não são exibidos
  await expect(page.locator(`[data-testid="supplier-card-${FORN1}"]`)).not.toBeVisible()
})

// ─────────────────────────────────────────────────────────────────────────────
// TC-F3 — "Proof of Impact" → "Prova de Impacto"
// ─────────────────────────────────────────────────────────────────────────────

test('T-PEDIDO-SAD-05: texto Prova de Impacto aparece nos recebimentos da instituição', async ({ page }) => {
  await setupPage(page)
  await fullGovernanceSetup(page)
  await loginAs(page, INST1, 'Novo Pedido')
  await createOrder(page, FORN1, 'Material TC-F3', 'Desc', '0.1')
  await logout(page)
  await loginAs(page, FORN1, 'Pedidos Recebidos')
  await confirmFirstDelivery(page)
  await logout(page)
  await loginAs(page, INST1, 'Novo Pedido')
  await page.getByRole('link', { name: 'Meus Recebimentos' }).click()
  await page.waitForURL('**/meus-recebimentos')
  await expect(page.locator('text=Prova de Impacto').first()).toBeVisible({ timeout: 15_000 })
})

test('T-PEDIDO-SAD-06: texto Proof of Impact não aparece em nenhuma parte do sistema', async ({ page }) => {
  await setupPage(page)
  await fullGovernanceSetup(page)
  await loginAs(page, INST1, 'Novo Pedido')
  await createOrder(page, FORN1, 'Material TC-F3-SAD', 'Desc', '0.1')
  await logout(page)
  await loginAs(page, FORN1, 'Pedidos Recebidos')
  await confirmFirstDelivery(page)
  await logout(page)
  await loginAs(page, INST1, 'Novo Pedido')
  await page.getByRole('link', { name: 'Meus Recebimentos' }).click()
  await page.waitForURL('**/meus-recebimentos')
  await expect(page.locator('text=Proof of Impact')).toHaveCount(0)
})

// ─────────────────────────────────────────────────────────────────────────────
// TC-F4 — Nome da instituição nos Pedidos Recebidos
// ─────────────────────────────────────────────────────────────────────────────

test('T-PEDIDO-SAD-07: pedidos recebidos mostra nome da instituição cadastrada', async ({ page }) => {
  await setupPage(page)
  await fullGovernanceSetup(page)
  await loginAs(page, INST1, 'Novo Pedido')
  await createOrder(page, FORN1, 'Material TC-F4', 'Desc', '0.1')
  await logout(page)
  await loginAs(page, FORN1, 'Pedidos Recebidos')
  await expect(page.locator(`text=${INST1_NAME}`).first()).toBeVisible({ timeout: 15_000 })
})

test('T-PEDIDO-SAD-08: endereço completo 0x não aparece nos pedidos recebidos', async ({ page }) => {
  await setupPage(page)
  await fullGovernanceSetup(page)
  await loginAs(page, INST1, 'Novo Pedido')
  await createOrder(page, FORN1, 'Material TC-F4-SAD', 'Desc', '0.1')
  await logout(page)
  await loginAs(page, FORN1, 'Pedidos Recebidos')
  const fullAddress = INST1.toLowerCase()
  await expect(page.locator(`text=${fullAddress}`)).toHaveCount(0)
})

// ─────────────────────────────────────────────────────────────────────────────
// TC-M7 — Novo Pedido avisa quando valor é maior que o saldo
// ─────────────────────────────────────────────────────────────────────────────

test('T-PEDIDO-SAD-09: novo pedido avisa saldo insuficiente antes de enviar', async ({ page }) => {
  await setupPage(page)
  await fullGovernanceSetup(page)
  await loginAs(page, INST1, 'Novo Pedido')
  await page.getByRole('link', { name: 'Novo Pedido' }).click()
  await page.waitForURL('**/novo-pedido')
  await page.locator(`[data-testid="supplier-card-${FORN1}"]`).click()
  await expect(page.getByTestId('modal-novo-pedido')).toBeVisible({ timeout: 10_000 })
  await expect(page.getByTestId('balance-alert')).toBeVisible({ timeout: 10_000 })
  await page.getByTestId('input-amount').fill('9999')
  await expect(page.locator('[data-testid="balance-warning"]').first()).toBeVisible({ timeout: 5_000 })
})

test('T-PEDIDO-SAD-10: aviso de saldo NÃO aparece quando valor está dentro do saldo', async ({ page }) => {
  await setupPage(page)
  await fullGovernanceSetup(page)
  await loginAs(page, INST1, 'Novo Pedido')
  await page.getByRole('link', { name: 'Novo Pedido' }).click()
  await page.waitForURL('**/novo-pedido')
  await page.locator(`[data-testid="supplier-card-${FORN1}"]`).click()
  await expect(page.getByTestId('modal-novo-pedido')).toBeVisible({ timeout: 10_000 })
  await expect(page.getByTestId('balance-alert')).toBeVisible({ timeout: 10_000 })
  await page.getByTestId('input-amount').fill('0.1')
  await expect(page.locator('[data-testid="balance-warning"]')).toHaveCount(0)
  await expect(page.locator('text=Saldo insuficiente')).toHaveCount(0)
})

// ─────────────────────────────────────────────────────────────────────────────
// TC-M8 — Fornecedor: Histórico de Recebidos mostra data e nome da instituição
// ─────────────────────────────────────────────────────────────────────────────

test('T-PEDIDO-SAD-11: histórico de recebidos mostra data e nome da instituição', async ({ page }) => {
  await setupPage(page)
  await fullGovernanceSetup(page)
  await loginAs(page, INST1, 'Novo Pedido')
  await createOrder(page, FORN1, 'Material TC-M8', 'Descrição', '0.1')
  await logout(page)
  await loginAs(page, FORN1, 'Pedidos Recebidos')
  await confirmFirstDelivery(page)
  await logout(page)
  await loginAs(page, INST1, 'Novo Pedido')
  await submitProof(page, 'prova-m8', 'proof-m8.txt')
  await logout(page)
  await loginAs(page, FORN1, 'Pedidos Recebidos')
  await page.getByRole('link', { name: 'Saldo' }).click()
  await page.waitForURL('**/saldo')
  const row = page.locator('[data-testid^="payment-row-"]').first()
  await expect(row).toBeVisible({ timeout: 30_000 })
  await expect(row.locator(`text=${INST1_NAME}`)).toBeVisible()
  await expect(row.locator('text=/\\d{2}\\/\\d{2}\\/\\d{4}/')).toBeVisible()
})

test('T-PEDIDO-SAD-12: histórico vazio mostra estado vazio sem quebrar a tela', async ({ page }) => {
  await setupPage(page)
  await fullGovernanceSetup(page)
  await loginAs(page, FORN1, 'Pedidos Recebidos')
  await page.getByRole('link', { name: 'Saldo' }).click()
  await page.waitForURL('**/saldo')
  await expect(page.locator('[data-testid="historico-recebimentos"]')).toBeVisible({ timeout: 10_000 })
  await expect(page.locator('[data-testid^="payment-row-"]')).toHaveCount(0)
})

// ─────────────────────────────────────────────────────────────────────────────
// TC-M9 — Instituição: Meus Recebimentos mostra link da Prova de Impacto
// ─────────────────────────────────────────────────────────────────────────────

test('T-PEDIDO-SAD-13: meus recebimentos da instituição mostra link da prova de impacto', async ({ page }) => {
  await setupPage(page)
  await fullGovernanceSetup(page)
  await loginAs(page, INST1, 'Novo Pedido')
  await createOrder(page, FORN1, 'Material TC-M9', 'Descrição', '0.1')
  await logout(page)
  await loginAs(page, FORN1, 'Pedidos Recebidos')
  await confirmFirstDelivery(page)
  await logout(page)
  await loginAs(page, INST1, 'Novo Pedido')
  await submitProof(page, 'prova-m9', 'proof-m9.txt')
  // submitProof deixa a página em meus-recebimentos; recarregar para ver dados atualizados
  await page.reload()
  await page.waitForURL('**/meus-recebimentos')
  const link = page.locator('[data-testid="section-historico"] a:has-text("Prova de Impacto")').first()
  await expect(link).toBeVisible({ timeout: 15_000 })
})

test('T-PEDIDO-SAD-14: pedido sem prova enviada não mostra link quebrado', async ({ page }) => {
  await setupPage(page)
  await fullGovernanceSetup(page)
  await loginAs(page, INST1, 'Novo Pedido')
  await createOrder(page, FORN1, 'Material TC-M9-SAD', 'Descrição', '0.1')
  await logout(page)
  await loginAs(page, FORN1, 'Pedidos Recebidos')
  await confirmFirstDelivery(page)
  await logout(page)
  await loginAs(page, INST1, 'Novo Pedido')
  await page.getByRole('link', { name: 'Meus Recebimentos' }).click()
  await page.waitForURL('**/meus-recebimentos')
  // Pedido ainda aguarda prova — não deve ter link quebrado com href vazio
  await expect(page.locator('a[href=""]')).toHaveCount(0)
})

// ─────────────────────────────────────────────────────────────────────────────
// TC-D1 — Bug: "Prazo Expirado" não aparece em pedidos concluídos corretamente
// ─────────────────────────────────────────────────────────────────────────────

test('T-PEDIDO-SAD-15: prazo expirado não aparece em pedido concluído corretamente no prazo', async ({ page }) => {
  await setupPage(page)
  await fullGovernanceSetup(page)
  await loginAs(page, INST1, 'Novo Pedido')
  await createOrder(page, FORN1, 'Material TC-D1', 'Descrição', '0.1')
  await logout(page)
  await loginAs(page, FORN1, 'Pedidos Recebidos')
  await confirmFirstDelivery(page)
  await logout(page)
  await loginAs(page, INST1, 'Novo Pedido')
  await submitProof(page, 'prova-d1', 'proof-d1.txt')
  await page.getByRole('link', { name: /Pedidos de Compra|Meus Pedidos/ }).click()
  await page.waitForURL('**/pedidos-de-compra')
  // Pedido concluído não deve mostrar prazo expirado
  await expect(page.locator('text=Prazo Expirado')).toHaveCount(0)
})

test('T-PEDIDO-SAD-16: prazo expirado aparece quando pedido não foi concluído no prazo', async ({ page }) => {
  await setupPage(page)
  await fullGovernanceSetup(page)
  await loginAs(page, INST1, 'Novo Pedido')
  await createOrder(page, FORN1, 'Material TC-D1-SAD', 'Descrição', '0.1')
  // Fornecedor não entrega → prazo de entrega expira
  await advanceTime(page, ADVANCE_WINDOW)
  await logout(page)
  await loginAs(page, INST1, 'Início')
  await page.getByRole('link', { name: /Pedidos de Compra|Meus Pedidos/ }).click()
  await page.waitForURL('**/pedidos-de-compra')
  await page.reload()
  // Prazo expirado deve aparecer (pedido Open expirado)
  await expect(page.locator('text=Prazo Expirado').first()).toBeVisible({ timeout: 15_000 })
})

// ─────────────────────────────────────────────────────────────────────────────
// TC-D2 — Meus Pedidos de Compra mostra data e sem prazo expirado se concluído
// ─────────────────────────────────────────────────────────────────────────────

test('T-PEDIDO-SAD-17: pedidos de compra mostra data e não mostra prazo expirado em pedido concluído', async ({ page }) => {
  await setupPage(page)
  await fullGovernanceSetup(page)
  await loginAs(page, INST1, 'Novo Pedido')
  await createOrder(page, FORN1, 'Material TC-D2', 'Descrição', '0.1')
  await logout(page)
  await loginAs(page, FORN1, 'Pedidos Recebidos')
  await confirmFirstDelivery(page)
  await logout(page)
  await loginAs(page, INST1, 'Novo Pedido')
  await submitProof(page, 'prova-d2', 'proof-d2.txt')
  await page.getByRole('link', { name: /Pedidos de Compra|Meus Pedidos/ }).click()
  await page.waitForURL('**/pedidos-de-compra')
  // Data deve estar visível
  await expect(page.locator('text=/\\d{2}\\/\\d{2}\\/\\d{4}/').first()).toBeVisible({ timeout: 15_000 })
  // Sem prazo expirado em pedido concluído
  await expect(page.locator('text=Prazo Expirado')).toHaveCount(0)
})

test('T-PEDIDO-SAD-18: pedido expirado mostra prazo expirado e data de criação', async ({ page }) => {
  await setupPage(page)
  await fullGovernanceSetup(page)
  await loginAs(page, INST1, 'Novo Pedido')
  await createOrder(page, FORN1, 'Material TC-D2-SAD', 'Descrição', '0.1')
  // Fornecedor não entrega → prazo expira
  await advanceTime(page, ADVANCE_WINDOW)
  await logout(page)
  await loginAs(page, INST1, 'Início')
  await page.getByRole('link', { name: /Pedidos de Compra|Meus Pedidos/ }).click()
  await page.waitForURL('**/pedidos-de-compra')
  await page.reload()
  // Data deve aparecer mesmo em pedido expirado
  await expect(page.locator('text=/\\d{2}\\/\\d{2}\\/\\d{4}/').first()).toBeVisible({ timeout: 15_000 })
  // Prazo expirado deve aparecer porque realmente expirou
  await expect(page.locator('text=Prazo Expirado').first()).toBeVisible({ timeout: 15_000 })
})

// ─────────────────────────────────────────────────────────────────────────────
// TC-D3 — Bug: botão "Confirmar" some e disputa aparece após prazo expirar
// ─────────────────────────────────────────────────────────────────────────────

test('T-PEDIDO-SAD-19: botão confirmar some e disputa aparece após prazo de confirmação expirar', async ({ page }) => {
  await setupPage(page)
  await fullGovernanceSetup(page)
  await loginAs(page, INST1, 'Novo Pedido')
  await createOrder(page, FORN1, 'Material TC-D3', 'Descrição', '0.1')
  await logout(page)
  await loginAs(page, FORN1, 'Pedidos Recebidos')
  await confirmFirstDelivery(page)
  // Avança além do confirmDeadline (180s) sem INST1 confirmar
  await advanceTime(page, ADVANCE_WINDOW)
  await logout(page)
  await loginAs(page, INST1, 'Início')
  await page.getByRole('link', { name: /Recebimentos|Meus Recebimentos/ }).click()
  await page.waitForURL('**/meus-recebimentos')
  await page.reload()
  // Botão confirmar NÃO deve aparecer após prazo
  await expect(page.locator('[data-testid^="btn-confirmar-"]')).toHaveCount(0)
  // Botão de disputa DEVE aparecer
  await expect(page.locator('[data-testid^="btn-abrir-disputa-"]').first()).toBeVisible({ timeout: 15_000 })
})

test('T-PEDIDO-SAD-20: botão confirmar aparece normalmente enquanto prazo não expirou', async ({ page }) => {
  await setupPage(page)
  await fullGovernanceSetup(page)
  await loginAs(page, INST1, 'Novo Pedido')
  await createOrder(page, FORN1, 'Material TC-D3-SAD', 'Descrição', '0.1')
  await logout(page)
  await loginAs(page, FORN1, 'Pedidos Recebidos')
  await confirmFirstDelivery(page)
  // NÃO avança tempo — prazo ainda não expirou
  await logout(page)
  await loginAs(page, INST1, 'Início')
  await page.getByRole('link', { name: /Recebimentos|Meus Recebimentos/ }).click()
  await page.waitForURL('**/meus-recebimentos')
  // Botão confirmar DEVE aparecer dentro do prazo
  await expect(page.locator('[data-testid^="btn-confirmar-"]').first()).toBeVisible({ timeout: 15_000 })
  // Botão de disputa NÃO deve aparecer ainda
  await expect(page.locator('[data-testid^="btn-abrir-disputa-"]')).toHaveCount(0)
})
