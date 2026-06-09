import type { EventLog, Provider } from 'ethers'
import { getPurchaseManagerContract } from '@/services/contractService'

// Busca os timestamps de uma lista de blocos e retorna um mapa blockNumber→timestamp.
async function fetchBlockTimestamps(
  provider: Provider,
  blockNumbers: number[],
): Promise<Map<number, number>> {
  const unique = [...new Set(blockNumbers)]
  const blocks = await Promise.all(unique.map((n) => provider.getBlock(n)))
  const map = new Map<number, number>()
  blocks.forEach((block, i) => {
    if (block) map.set(unique[i], block.timestamp)
  })
  return map
}

// Constrói um objeto Purchase combinando dados do evento e dados atuais do contrato.
async function buildPurchaseFromEvent(
  contract: ReturnType<typeof getPurchaseManagerContract>,
  purchaseId: bigint,
  eventArgs: {
    institution: string
    supplier: string
    amount: bigint
    deliveryDeadline: bigint
    descriptionHash: string
    createdAt?: number
  },
): Promise<Purchase> {
  const data = await contract.getPurchase(purchaseId)
  return {
    purchaseId,
    institution: eventArgs.institution,
    supplier: eventArgs.supplier,
    amount: eventArgs.amount,
    deliveryDeadline: eventArgs.deliveryDeadline,
    descriptionHash: eventArgs.descriptionHash,
    status: Number(data.status) as PurchaseStatus,
    impactProofHash: data.impactProofHash as string,
    confirmDeadline: data.confirmDeadline as bigint,
    disputeDeadline: data.disputeDeadline as bigint,
    supplierVoteWeight: data.supplierVoteWeight as bigint,
    institutionVoteWeight: data.institutionVoteWeight as bigint,
    createdAt: eventArgs.createdAt,
  }
}

export enum PurchaseStatus {
  Open = 0,
  Delivered = 1,
  Confirmed = 2,
  Disputed = 3,
  Paid = 4,
  Refunded = 5,
}

export const PURCHASE_STATUS_LABELS: Record<PurchaseStatus, string> = {
  [PurchaseStatus.Open]: 'Aberto',
  [PurchaseStatus.Delivered]: 'Entregue',
  [PurchaseStatus.Confirmed]: 'Confirmado',
  [PurchaseStatus.Disputed]: 'Em Disputa',
  [PurchaseStatus.Paid]: 'Pago',
  [PurchaseStatus.Refunded]: 'Devolvido',
}

export const PURCHASE_STATUS_COLORS: Record<PurchaseStatus, string> = {
  [PurchaseStatus.Open]: 'blue',
  [PurchaseStatus.Delivered]: 'yellow',
  [PurchaseStatus.Confirmed]: 'cyan',
  [PurchaseStatus.Disputed]: 'orange',
  [PurchaseStatus.Paid]: 'green',
  [PurchaseStatus.Refunded]: 'gray',
}

// Verifica se um prazo (Unix timestamp em segundos) já expirou.
export function isDeadlineExpired(deadline: bigint): boolean {
  return deadline < BigInt(Math.floor(Date.now() / 1000))
}

export interface Purchase {
  purchaseId: bigint
  institution: string
  supplier: string
  amount: bigint
  deliveryDeadline: bigint
  descriptionHash: string
  status: PurchaseStatus
  impactProofHash: string
  confirmDeadline: bigint
  disputeDeadline: bigint
  supplierVoteWeight: bigint
  institutionVoteWeight: bigint
  createdAt?: number
}

export interface ResolvedDispute {
  purchaseId: bigint
  institution: string
  supplier: string
  amount: bigint
  supplierWon: boolean
  resolvedAt: number
  supplierVoteWeight: bigint
  institutionVoteWeight: bigint
}

// Busca todos os pedidos de compra abertos por uma instituição específica.
export async function fetchPurchasesByInstitution(
  provider: Provider,
  institutionAddress: string,
): Promise<Purchase[]> {
  const contract = getPurchaseManagerContract(provider)
  const filter = contract.filters.PurchaseOpened(null, institutionAddress)
  const events = await contract.queryFilter(filter)

  const blockNumbers = events.map((e) => e.blockNumber)
  const timestamps = await fetchBlockTimestamps(provider, blockNumbers)

  return Promise.all(
    events.map((event) => {
      const log = event as EventLog
      return buildPurchaseFromEvent(contract, log.args.purchaseId as bigint, {
        institution: log.args.institution as string,
        supplier: log.args.supplier as string,
        amount: log.args.amount as bigint,
        deliveryDeadline: log.args.deliveryDeadline as bigint,
        descriptionHash: log.args.descriptionHash as string,
        createdAt: timestamps.get(log.blockNumber),
      })
    }),
  )
}

// Busca todos os pedidos de compra direcionados a um fornecedor específico.
export async function fetchPurchasesBySupplier(
  provider: Provider,
  supplierAddress: string,
): Promise<Purchase[]> {
  const contract = getPurchaseManagerContract(provider)
  const filter = contract.filters.PurchaseOpened(null, null, supplierAddress)
  const events = await contract.queryFilter(filter)

  return Promise.all(
    events.map((event) => {
      const log = event as EventLog
      return buildPurchaseFromEvent(contract, log.args.purchaseId as bigint, {
        institution: log.args.institution as string,
        supplier: log.args.supplier as string,
        amount: log.args.amount as bigint,
        deliveryDeadline: log.args.deliveryDeadline as bigint,
        descriptionHash: log.args.descriptionHash as string,
      })
    }),
  )
}

// Busca todos os pedidos atualmente em disputa via eventos DisputeOpened.
export async function fetchDisputedPurchases(provider: Provider): Promise<Purchase[]> {
  const contract = getPurchaseManagerContract(provider)
  const filter = contract.filters.DisputeOpened()
  const events = await contract.queryFilter(filter)

  const purchases = await Promise.all(
    events.map(async (event) => {
      const log = event as EventLog
      const purchaseId = log.args.purchaseId as bigint
      const data = await contract.getPurchase(purchaseId)
      return {
        purchaseId,
        institution: data.institution as string,
        supplier: data.supplier as string,
        amount: data.amount as bigint,
        deliveryDeadline: data.deliveryDeadline as bigint,
        descriptionHash: data.descriptionHash as string,
        status: Number(data.status) as PurchaseStatus,
        impactProofHash: data.impactProofHash as string,
        confirmDeadline: data.confirmDeadline as bigint,
        disputeDeadline: data.disputeDeadline as bigint,
        supplierVoteWeight: data.supplierVoteWeight as bigint,
        institutionVoteWeight: data.institutionVoteWeight as bigint,
      }
    }),
  )

  return purchases.filter((p) => p.status === PurchaseStatus.Disputed)
}

// Busca todas as disputas já resolvidas via eventos DisputeResolved.
export async function fetchResolvedDisputes(provider: Provider): Promise<ResolvedDispute[]> {
  const contract = getPurchaseManagerContract(provider)
  const filter = contract.filters.DisputeResolved()
  const events = await contract.queryFilter(filter)

  const blockNumbers = events.map((e) => e.blockNumber)
  const timestamps = await fetchBlockTimestamps(provider, blockNumbers)

  return Promise.all(
    events.map(async (event) => {
      const log = event as EventLog
      const purchaseId = log.args.purchaseId as bigint
      const supplierWon = log.args.supplierWon as boolean
      const data = await contract.getPurchase(purchaseId)
      return {
        purchaseId,
        institution: data.institution as string,
        supplier: data.supplier as string,
        amount: data.amount as bigint,
        supplierWon,
        resolvedAt: timestamps.get(log.blockNumber) ?? 0,
        supplierVoteWeight: data.supplierVoteWeight as bigint,
        institutionVoteWeight: data.institutionVoteWeight as bigint,
      }
    }),
  )
}
