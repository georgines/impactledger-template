/**
 * Helpers compartilhados pelos testes E2E do EloSolidário.
 */

import { type Page, expect } from '@playwright/test'
import path from 'path'
import fs from 'fs'
import os from 'os'
import { increaseTime, revertSnapshot, takeSnapshot, anvilRpc } from './anvilHelpers'
import { MOCK_ETHEREUM_SCRIPT } from './mockEthereum'

// ── Contas Anvil ──────────────────────────────────────────────────────────────
export const OPERATOR = '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266'
export const DONOR1   = '0x70997970C51812dc3A010C7d01b50e0d17dc79C8'
export const DONOR2   = '0x15d34AAf54267DB7D7c367839AAf71A00a2C6A65'
export const DONOR3   = '0x14dC79964da2C08b23698B3D3cc7Ca32193d9955'
export const INST1    = '0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC'
export const INST2    = '0x9965507D1a55bcC2695C58ba16FB37d819B0A4dc'
export const INST3    = '0x23618e81E3f5cdF7f54C3d65f7FBc0aBf5B21E8f'
export const FORN1    = '0x90F79bf6EB2c4f870365E785982E1f101E93b906'
export const FORN2    = '0x976EA74026E726554dB657fA54763abd0C3a0aa9'
export const FORN3    = '0xa0Ee7A142d267C1f36714E4a8F75612F20a79720'

// ── Dados do roteiro ──────────────────────────────────────────────────────────
export const INST1_NAME = 'Instituto Esperança'
export const INST1_AREA = 'educação'
export const INST2_NAME = 'Fundação Saúde Viva'
export const INST2_AREA = 'saúde'
export const INST3_NAME = 'Casa Animal Feliz'
export const INST3_AREA = 'proteção animal'
export const FORN1_NAME = 'LogTech Soluções'
export const FORN1_TYPE = 'logística'
export const FORN2_NAME = 'DataImpacto Tecnologia'
export const FORN2_TYPE = 'tecnologia'
export const FORN3_NAME = 'VetSupply Brasil'
export const FORN3_TYPE = 'suprimentos veterinários'

export const DEADLINE_TEST = '90' // segundos

export const SNAPSHOT_FILE = path.resolve(__dirname, '..', '.snapshot')

// Offset acumulado por arquivo de teste (resetar no beforeEach)
export let timeOffsetMs = 0
export function resetTimeOffset() { timeOffsetMs = 0 }

// ── Helpers base ──────────────────────────────────────────────────────────────

export async function setupPage(page: Page) {
  await page.addInitScript({ content: MOCK_ETHEREUM_SCRIPT })
}

export async function loginAs(page: Page, address: string, expectedNavItem: string) {
  // Clear stale address before reload so tryAutoConnect doesn't race with the new login
  try {
    await page.evaluate(() => {
      try { localStorage.removeItem('__pw_eth_addr') } catch (_) {}
    })
  } catch (_) {}
  await page.goto('/')
  // Sincroniza o Date.now() do browser com o offset do teste atual.
  // Evita que o localStorage de testes anteriores contamine o tempo desta execução.
  await page.evaluate((offset: number) => {
    ;(window as Window & { __pw_time_offset?: number }).__pw_time_offset = offset
    try { localStorage.setItem('__pw_time_offset', String(offset)) } catch (_) {}
  }, timeOffsetMs)
  await page.getByRole('button', { name: /Conectar Carteira/i }).waitFor({ timeout: 10_000 })
  await page.evaluate((addr: string) => {
    const w = window as Window & { __setEthAccount?: (a: string) => void; __pw_eth_addr?: string }
    w.__pw_eth_addr = addr
    if (w.__setEthAccount) w.__setEthAccount(addr)
  }, address)
  await page.getByRole('button', { name: /Conectar Carteira/i }).click()
  await page.waitForURL('**/inicio', { timeout: 15_000 })
  await expect(page.getByRole('link', { name: expectedNavItem })).toBeVisible({ timeout: 10_000 })
}

export async function logout(page: Page) {
  await closeOpenModal(page)
  await page.getByTestId('logout-button').click()
  await page.waitForURL('/', { timeout: 10_000 })
  await page.evaluate(() => {
    try { localStorage.removeItem('__pw_eth_addr') } catch (_) {}
    const w = window as Window & { __setEthAccount?: (a: string | null) => void }
    if (w.__setEthAccount) w.__setEthAccount(null as unknown as string)
  })
}

export async function closeOpenModal(page: Page) {
  const overlay = page.locator('.mantine-Modal-overlay')
  if (await overlay.isVisible()) {
    await page.keyboard.press('Escape')
    await overlay.waitFor({ state: 'hidden', timeout: 5_000 })
  }
}

const _votingPeriod     = Number(process.env.PERIODO_VOTACAO    ?? '120')
const _disputeWindow    = Number(process.env.JANELA_DISPUTA      ?? '120')
const _confirmWindow    = Number(process.env.JANELA_CONFIRMACAO  ?? '120')
export const ADVANCE_WINDOW = Math.max(_votingPeriod, _disputeWindow, _confirmWindow) + 60

export async function advanceTime(page: Page, seconds: number) {
  await increaseTime(seconds)
  timeOffsetMs += seconds * 1_000
  const offset = timeOffsetMs
  await page.evaluate((ms: number) => {
    ;(window as Window & { __advanceTime?: (ms: number) => void }).__advanceTime?.(ms)
  }, offset)
}

export async function voteOnFirstProposal(page: Page) {
  await page.getByRole('link', { name: 'Propostas em Votação' }).click()
  await page.waitForURL('**/em-votacao')
  await expect(page.getByTestId('empty-proposals')).not.toBeVisible({ timeout: 15_000 })
  await page.getByRole('button', { name: 'Votar' }).first().click()
  await expect(page.getByText('Você concorda com essa mudança?')).toBeVisible({ timeout: 10_000 })
  await page.getByTestId('btn-concordo').click()
  await expect(page.getByText('Você concorda com essa mudança?')).not.toBeVisible({ timeout: 30_000 })
}

export async function finalizeFirstProposal(page: Page) {
  if (!page.url().includes('/em-votacao')) {
    await page.getByRole('link', { name: 'Propostas em Votação' }).click()
    await page.waitForURL('**/em-votacao')
  }
  await expect(page.getByRole('button', { name: 'Finalizar' }).first()).toBeVisible({ timeout: 15_000 })
  await page.getByRole('button', { name: 'Finalizar' }).first().click()
  await expect(page.getByTestId('empty-proposals')).toBeVisible({ timeout: 30_000 })
}

export function makeTmpFile(content: string, name: string): string {
  const p = path.join(os.tmpdir(), name)
  fs.writeFileSync(p, content)
  return p
}

export async function beforeEachReset() {
  resetTimeOffset()
  if (fs.existsSync(SNAPSHOT_FILE)) {
    const id = fs.readFileSync(SNAPSHOT_FILE, 'utf-8').trim()
    await revertSnapshot(id)
    // Ressincroniza o timestamp do EVM com o tempo real.
    // Após evm_revert, o EVM fica no T0 do globalSetup. O tempo real avançou.
    // Se não ressincronizar, a UI vê propostas como expiradas porque Date.now() > EVM time.
    const realNow = Math.floor(Date.now() / 1000)
    await anvilRpc('evm_setNextBlockTimestamp', [realNow])
    await anvilRpc('evm_mine')
    const newId = await takeSnapshot()
    fs.writeFileSync(SNAPSHOT_FILE, newId, 'utf-8')
  }
}

// ── Helpers de nível alto ─────────────────────────────────────────────────────

export async function bootstrap(page: Page, addr: string, name: string, area: string) {
  await page.getByRole('link', { name: 'Cadastrar Instituição' }).click()
  await page.waitForURL('**/cadastro/instituicoes')
  await expect(page.getByTestId('bootstrap-section')).toBeVisible({ timeout: 10_000 })
  await page.getByLabel('Endereço').fill(addr)
  await page.getByLabel('Nome').fill(name)
  await page.getByLabel('Área de Atuação').fill(area)
  await page.getByRole('button', { name: 'Registrar Primeira Instituição' }).click()
  await expect(page.getByTestId('bootstrap-success')).toBeVisible({ timeout: 30_000 })
}

export async function proposeInstitution(page: Page, addr: string, name: string, area: string) {
  await page.getByRole('link', { name: 'Cadastrar Instituição' }).click()
  await page.waitForURL('**/cadastro/instituicoes')
  await page.getByLabel('Endereço').fill(addr)
  await page.getByLabel('Nome').fill(name)
  await page.getByLabel('Área de Atuação').fill(area)
  await page.getByRole('button', { name: 'Propor' }).click()
  await expect(page.getByText('Proposta registrada com sucesso!')).toBeVisible({ timeout: 30_000 })
}

export async function proposeSupplier(page: Page, addr: string, name: string, type: string) {
  await page.getByRole('link', { name: 'Cadastrar Fornecedor' }).click()
  await page.waitForURL('**/cadastro/fornecedores')
  await page.getByLabel('Endereço do Fornecedor').fill(addr)
  await page.getByLabel('Nome').fill(name)
  await page.getByLabel('Tipo de Serviço').fill(type)
  await page.getByRole('button', { name: 'Propor' }).click()
  await expect(page.getByText('Proposta registrada com sucesso!')).toBeVisible({ timeout: 30_000 })
}

export async function donate(page: Page, donor: string, instAddr: string, amount: string) {
  await loginAs(page, donor, 'Fazer Doação')
  await page.getByRole('link', { name: 'Fazer Doação' }).click()
  await page.waitForURL('**/fazer-doacao')
  await page.locator(`[data-testid="institution-card-${instAddr}"]`).click()
  await page.getByLabel('Valor (ETH)').fill(amount)
  await page.getByTestId('btn-confirmar-doacao').click()
  await expect(page.getByTestId('donation-success')).toBeVisible({ timeout: 30_000 })
}

/** Propõe, faz todos os voters votarem, avança o tempo e o operador finaliza. */
export async function proposeVoteFinalize(
  page: Page,
  proposeFn: (page: Page) => Promise<void>,
  voters: string[],
) {
  // Garante que o OPERATOR está logado antes de propor
  await loginAs(page, OPERATOR, 'Cadastrar Instituição')
  await proposeFn(page)
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

/**
 * Setup completo de governança: bootstrap INST1, aprova INST2+INST3+FORN1+FORN2+FORN3
 * e faz doações de todos os doadores para todas as instituições.
 * Deixa o operador logado ao final.
 */
export async function fullGovernanceSetup(page: Page) {
  // 1. Bootstrap da primeira instituição
  await loginAs(page, OPERATOR, 'Cadastrar Instituição')
  await bootstrap(page, INST1, INST1_NAME, INST1_AREA)

  // 2. Doadores doam para INST1 ANTES de qualquer proposta
  //    Isso garante peso de voto nas propostas seguintes
  await donate(page, DONOR1, INST1, '5')
  await logout(page)
  await donate(page, DONOR2, INST1, '5')
  await logout(page)
  await donate(page, DONOR3, INST1, '5')
  await logout(page)

  // 3. Aprovação das demais instituições e fornecedores
  await proposeVoteFinalize(
    page,
    (p) => proposeInstitution(p, INST2, INST2_NAME, INST2_AREA),
    [DONOR1, DONOR2, DONOR3],
  )

  await proposeVoteFinalize(
    page,
    (p) => proposeInstitution(p, INST3, INST3_NAME, INST3_AREA),
    [DONOR1, DONOR2, DONOR3],
  )

  await proposeVoteFinalize(
    page,
    (p) => proposeSupplier(p, FORN1, FORN1_NAME, FORN1_TYPE),
    [DONOR1, DONOR2, DONOR3],
  )

  await proposeVoteFinalize(
    page,
    (p) => proposeSupplier(p, FORN2, FORN2_NAME, FORN2_TYPE),
    [DONOR1, DONOR2, DONOR3],
  )

  await proposeVoteFinalize(
    page,
    (p) => proposeSupplier(p, FORN3, FORN3_NAME, FORN3_TYPE),
    [DONOR1, DONOR2, DONOR3],
  )

  // 4. Doações cruzadas para financiar pedidos em todas as instituições
  await donate(page, DONOR1, INST2, '5')
  await logout(page)
  await donate(page, DONOR1, INST3, '5')
  await logout(page)
  await donate(page, DONOR2, INST2, '5')
  await logout(page)
  await donate(page, DONOR2, INST3, '5')
  await logout(page)
  await donate(page, DONOR3, INST1, '5')
  await logout(page)
  await donate(page, DONOR3, INST3, '5')
  await logout(page)
}

/** Cria pedido como INST logada. */
export async function createOrder(
  page: Page,
  supplierAddr: string,
  title: string,
  desc: string,
  amount: string,
) {
  await page.getByRole('link', { name: 'Novo Pedido' }).click()
  await page.waitForURL('**/novo-pedido')
  await page.locator(`[data-testid="supplier-card-${supplierAddr}"]`).click()
  await expect(page.getByTestId('modal-novo-pedido')).toBeVisible({ timeout: 10_000 })
  await page.getByTestId('input-title').fill(title)
  await page.getByTestId('input-description').fill(desc)
  await page.getByTestId('input-amount').fill(amount)
  await page.getByTestId('input-deadline').fill(DEADLINE_TEST)
  await page.getByTestId('btn-criar-pedido').click()
  await expect(page.getByTestId('order-success')).toBeVisible({ timeout: 30_000 })
}

/** FORN logado confirma primeira entrega visível. */
export async function confirmFirstDelivery(page: Page) {
  await page.getByRole('link', { name: 'Pedidos Recebidos' }).click()
  await page.waitForURL('**/pedidos-recebidos')
  await expect(page.locator('[data-testid^="btn-confirmar-entrega-"]').first()).toBeVisible({ timeout: 15_000 })
  await page.locator('[data-testid^="btn-confirmar-entrega-"]').first().click()
  await expect(page.locator('[data-testid^="status-badge-"]').last()).toContainText('Entregue', { timeout: 30_000 })
}

/** INST logada submete proof para primeiro pedido aguardando. */
export async function submitProof(page: Page, fileContent: string, fileName: string) {
  await page.getByRole('link', { name: 'Meus Recebimentos' }).click()
  await page.waitForURL('**/meus-recebimentos')
  await expect(page.getByTestId('section-aguardando-proof')).toBeVisible({ timeout: 15_000 })
  const file = makeTmpFile(fileContent, fileName)
  await page.locator('[data-testid^="input-proof-file-"]').first().setInputFiles(file)
  await expect(page.locator('[data-testid^="btn-confirmar-"]').first()).toBeEnabled({ timeout: 5_000 })
  await page.locator('[data-testid^="btn-confirmar-"]').first().click()
  await expect(page.getByTestId('proof-success')).toBeVisible({ timeout: 60_000 })
}

/** Envia evidência na página minhas-disputas para a disputa ativa. */
export async function sendEvidence(page: Page, fileContent: string, fileName: string) {
  await page.getByRole('link', { name: 'Minhas Disputas', exact: true }).click()
  await page.waitForURL('**/minhas-disputas')
  await expect(page.getByTestId('empty-minhas-disputas')).not.toBeVisible({ timeout: 15_000 })
  const file = makeTmpFile(fileContent, fileName)
  await page.locator('[data-testid^="input-evidence-file-"]').first().setInputFiles(file)
  await expect(page.locator('[data-testid^="btn-enviar-evidencia-"]').first()).toBeEnabled({ timeout: 5_000 })
  await page.locator('[data-testid^="btn-enviar-evidencia-"]').first().click()
  await expect(page.getByTestId('evidence-success')).toBeVisible({ timeout: 60_000 })
}

/** Doador logado vota em disputa ativa. */
export async function voteOnDispute(page: Page, supportSupplier: boolean) {
  await page.getByRole('link', { name: 'Disputas Ativas' }).click()
  await page.waitForURL('**/disputas-ativas')
  await expect(page.getByTestId('empty-disputas-ativas')).not.toBeVisible({ timeout: 15_000 })
  const btn = supportSupplier
    ? page.locator('[data-testid^="btn-votar-fornecedor-"]').first()
    : page.locator('[data-testid^="btn-votar-instituicao-"]').first()
  await btn.click()
  await expect(page.getByTestId('vote-success')).toBeVisible({ timeout: 30_000 })
}

/** Finaliza disputa depois do prazo. Requer doador logado em disputas-ativas. */
export async function finalizeDispute(page: Page) {
  if (!page.url().includes('/disputas-ativas')) {
    await page.getByRole('link', { name: 'Disputas Ativas' }).click()
    await page.waitForURL('**/disputas-ativas')
  }
  await expect(page.locator('[data-testid^="btn-finalizar-disputa-"]').first()).toBeVisible({ timeout: 15_000 })
  await page.locator('[data-testid^="btn-finalizar-disputa-"]').first().click()
  await expect(page.getByTestId('empty-disputas-ativas')).toBeVisible({ timeout: 30_000 })
}
