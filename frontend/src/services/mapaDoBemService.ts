import type { EventLog, Provider } from 'ethers'
import { getPurchaseManagerContract, getTreasuryContract } from '@/services/contractService'
import deployConfig from '@deploy-atual'

const FROM_BLOCK: number =
  'deployedAtBlock' in deployConfig &&
  typeof (deployConfig as Record<string, unknown>).deployedAtBlock === 'number'
    ? (deployConfig as { deployedAtBlock: number }).deployedAtBlock
    : 0

export interface PaymentRecord {
  purchaseId: bigint
  institution: string
  supplier: string
  amount: bigint
  impactProofHash: string
  descriptionHash: string
  blockNumber: number
  txHash: string
  timestamp: number
}

export interface DonationActivity {
  kind: 'donation'
  blockNumber: number
  txHash: string
  donor: string
  institution: string
  amount: bigint
  timestamp: number
}

export interface PaymentActivity {
  kind: 'payment'
  blockNumber: number
  txHash: string
  purchaseId: bigint
  institution: string
  supplier: string
  amount: bigint
  impactProofHash: string
  descriptionHash: string
  timestamp: number
}

export type ActivityEvent = DonationActivity | PaymentActivity

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

// Constrói um PaymentRecord combinando dados do evento ImmutableReceipt com dados do contrato.
async function buildPaymentRecord(
  contract: ReturnType<typeof getPurchaseManagerContract>,
  event: EventLog,
  timestamp: number,
): Promise<PaymentRecord> {
  const purchaseId = event.args.purchaseId as bigint
  const purchase = await contract.getPurchase(purchaseId)
  return {
    purchaseId,
    institution: event.args.institution as string,
    supplier: event.args.supplier as string,
    amount: event.args.amount as bigint,
    impactProofHash: event.args.impactProofHash as string,
    descriptionHash: purchase.descriptionHash as string,
    blockNumber: event.blockNumber,
    txHash: event.transactionHash,
    timestamp,
  }
}

// Busca todos os pagamentos liberados via eventos ImmutableReceipt ordenados por bloco.
export async function fetchAllPayments(provider: Provider): Promise<PaymentRecord[]> {
  const contract = getPurchaseManagerContract(provider)
  const events = await contract.queryFilter(contract.filters.ImmutableReceipt(), FROM_BLOCK)
  const blockNums = events.map((e) => e.blockNumber)
  const timestamps = await fetchBlockTimestamps(provider, blockNums)
  const records = await Promise.all(
    events.map((event) =>
      buildPaymentRecord(contract, event as EventLog, timestamps.get(event.blockNumber) ?? 0),
    ),
  )
  return records.sort((a, b) => b.blockNumber - a.blockNumber)
}

// Busca todas as doações registradas na plataforma como atividades com timestamp.
export async function fetchAllDonations(provider: Provider): Promise<DonationActivity[]> {
  const treasury = getTreasuryContract(provider)
  const events = await treasury.queryFilter(treasury.filters.DonationReceived(), FROM_BLOCK)
  const blockNums = events.map((e) => e.blockNumber)
  const timestamps = await fetchBlockTimestamps(provider, blockNums)
  return events.map((event) => {
    const log = event as EventLog
    return {
      kind: 'donation' as const,
      blockNumber: log.blockNumber,
      txHash: log.transactionHash,
      donor: log.args.donor as string,
      institution: log.args.institution as string,
      amount: log.args.amount as bigint,
      timestamp: timestamps.get(log.blockNumber) ?? 0,
    }
  })
}

// Busca e combina doações e pagamentos em um feed de atividade ordenado por bloco.
export async function fetchAllActivity(provider: Provider): Promise<ActivityEvent[]> {
  const [payments, donations] = await Promise.all([
    fetchAllPayments(provider),
    fetchAllDonations(provider),
  ])

  const paymentActivities: PaymentActivity[] = payments.map((p) => ({
    kind: 'payment' as const,
    ...p,
  }))

  return [...paymentActivities, ...donations].sort((a, b) => b.blockNumber - a.blockNumber)
}
