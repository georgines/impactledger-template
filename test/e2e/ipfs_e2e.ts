/**
 * Teste E2E — API local IPFS com suporte a redes pública e privada
 *
 * Pré-requisitos:
 *   yarn dev          (frontend em localhost:3000)
 *   CHAVE_PINATA        configurado no ambiente do servidor
 *   URL_GATEWAY_PINATA=https://<subdominio>.mypinata.cloud/ipfs
 *
 * Executar:
 *   npx ts-node test/e2e/ipfs_e2e.ts
 *
 * Rotas testadas (sem query params):
 *   POST /api/ipfs/upload/public          → sobe arquivo público → CID
 *   POST /api/ipfs/upload/private         → sobe arquivo privado → CID
 *   GET  /api/ipfs/fetch/public/:cid      → lê via gateway /ipfs/<cid>
 *   GET  /api/ipfs/fetch/private/:cid     → lê via gateway /files/<cid>
 *   GET  /api/ipfs/files/public/:cid      → metadados do arquivo público
 *   GET  /api/ipfs/files/private/:cid     → metadados do arquivo privado
 *
 * Fluxo (igual ao da aplicação real):
 *   CID bruto → cidToBytes32 → bytes32 (blockchain)
 *   bytes32 → bytes32ToCid → CID → fetch
 */

import { cidToBytes32, bytes32ToCid } from '../../frontend/src/lib/cid'

const BASE = 'http://localhost:3000'

interface UploadResponse {
  cid: string
  network: string
  error?: string
}

interface PinnedFile {
  id: string
  cid: string
  name: string
  size: number
  createdAt: string
  gatewayUrl: string
}

const PAYLOAD = {
  descricao: 'Pedido de compra e2e',
  valor: 1500,
  fornecedor: '0xABCDEF1234567890ABCDEF1234567890ABCDEF12',
  timestamp: new Date().toISOString(),
}

// ── helpers ──────────────────────────────────────────────────────────────────

function ok(label: string, detail?: unknown) {
  const suffix = detail !== undefined ? ` — ${JSON.stringify(detail)}` : ''
  console.log(`  ✓ ${label}${suffix}`)
}

function fail(label: string, detail?: unknown): never {
  const suffix = detail !== undefined ? ` — ${JSON.stringify(detail)}` : ''
  console.error(`  ✗ ${label}${suffix}`)
  process.exit(1)
}

function makeFileName(tag: string) {
  return `pedido_e2e_${tag}_${Date.now()}.json`
}

// ── passos ───────────────────────────────────────────────────────────────────

async function upload(network: 'public' | 'private', fileName: string): Promise<{ cidBruto: string; bytes32: string }> {
  console.log(`\n[upload/${network}]`)
  console.log(`  arquivo : ${fileName}`)

  const form = new FormData()
  form.append(
    'file',
    new Blob([JSON.stringify(PAYLOAD)], { type: 'application/json' }),
    fileName,
  )

  const res = await fetch(`${BASE}/api/ipfs/upload/${network}`, { method: 'POST', body: form })

  if (res.status !== 200) {
    fail(`status esperado 200, recebeu ${res.status}`, await res.text())
  }

  const body = (await res.json()) as UploadResponse

  if (!body.cid || typeof body.cid !== 'string' || body.cid.length < 10) {
    fail('resposta não contém CID válido', body)
  }

  const cidBruto = body.cid
  const bytes32 = cidToBytes32(cidBruto)

  ok(`CID bruto`, cidBruto)
  ok(`bytes32`, bytes32)
  ok(`round-trip`, bytes32ToCid(bytes32) === cidBruto ? 'ok' : 'DIVERGE')

  return { cidBruto, bytes32 }
}

async function fetchConteudo(network: 'public' | 'private', bytes32: string): Promise<void> {
  const cidReconstruido = bytes32ToCid(bytes32)
  console.log(`\n[fetch/${network}]`)
  console.log(`  CID: ${cidReconstruido}`)

  const res = await fetch(`${BASE}/api/ipfs/fetch/${network}/${cidReconstruido}`)

  if (res.status !== 200) {
    fail(`status esperado 200, recebeu ${res.status}`, await res.text())
  }

  const conteudo = (await res.json()) as Record<string, unknown>

  const campos: Array<keyof typeof PAYLOAD> = ['descricao', 'valor', 'fornecedor']
  for (const campo of campos) {
    if (conteudo[campo] !== PAYLOAD[campo]) {
      fail(`campo "${campo}" diverge`, { esperado: PAYLOAD[campo], recebido: conteudo[campo] })
    }
  }

  ok('conteúdo idêntico ao enviado')
}

async function metadados(network: 'public' | 'private', cidBruto: string): Promise<void> {
  console.log(`\n[files/${network}/${cidBruto}]`)

  // Pequeno delay para Pinata indexar
  await new Promise((r) => setTimeout(r, 2_000))

  const res = await fetch(`${BASE}/api/ipfs/files/${network}/${cidBruto}`)

  if (res.status !== 200) {
    fail(`status esperado 200, recebeu ${res.status}`, await res.text())
  }

  const arquivo = (await res.json()) as PinnedFile

  if (!arquivo.cid || arquivo.cid !== cidBruto) {
    fail('CID retornado diverge', { esperado: cidBruto, recebido: arquivo.cid })
  }

  ok('metadados encontrados', { name: arquivo.name, cid: arquivo.cid, size: arquivo.size })
}

// ── runner ───────────────────────────────────────────────────────────────────

async function run() {
  console.log('=== E2E IPFS API (público e privado) ===')
  console.log(`Base URL : ${BASE}`)

  // ── REDE PÚBLICA ──────────────────────────────────────────────────────────
  console.log('\n──── REDE PÚBLICA ────')
  const pubFile = makeFileName('pub')
  const { cidBruto: pubCid, bytes32: pubBytes32 } = await upload('public', pubFile)
  await fetchConteudo('public', pubBytes32)
  await metadados('public', pubCid)

  // ── REDE PRIVADA ──────────────────────────────────────────────────────────
  console.log('\n──── REDE PRIVADA ────')
  const privFile = makeFileName('priv')
  const { cidBruto: privCid, bytes32: privBytes32 } = await upload('private', privFile)
  await fetchConteudo('private', privBytes32)
  await metadados('private', privCid)

  // ── RESUMO ────────────────────────────────────────────────────────────────
  console.log('\n=== RESUMO ===')
  console.log(`  público  → CID: ${pubCid}  bytes32: ${pubBytes32}`)
  console.log(`  privado  → CID: ${privCid}  bytes32: ${privBytes32}`)
  console.log('\n  upload ✓  fetch ✓  metadados ✓  (público e privado)')
  console.log('\nTodos os passos concluídos com sucesso.')
}

run().catch((err: unknown) => {
  console.error('\nErro inesperado:', err)
  process.exit(1)
})
