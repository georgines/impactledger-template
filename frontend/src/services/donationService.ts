import type { EventLog, Log, Provider } from 'ethers'
import { getTreasuryContract } from '@/services/contractService'

export interface DonationRecord {
  institution: string
  amount: bigint
  txHash: string
  blockNumber: number
}

// Mapeia um evento DonationReceived para a interface DonationRecord.
function mapDonationEvent(event: Log): DonationRecord {
  const log = event as EventLog
  return {
    institution: log.args.institution as string,
    amount: log.args.amount as bigint,
    txHash: log.transactionHash,
    blockNumber: log.blockNumber,
  }
}

// Busca todas as doações feitas por um doador específico via eventos on-chain.
export async function fetchMyDonations(
  donorAddress: string,
  provider: Provider,
): Promise<DonationRecord[]> {
  const contract = getTreasuryContract(provider)
  const events = await contract.queryFilter(contract.filters.DonationReceived(donorAddress))
  return events.map(mapDonationEvent)
}

// Busca todas as doações registradas na plataforma via eventos on-chain.
export async function fetchAllDonations(provider: Provider): Promise<DonationRecord[]> {
  const contract = getTreasuryContract(provider)
  const events = await contract.queryFilter(contract.filters.DonationReceived())
  return events.map(mapDonationEvent)
}

// Soma o valor total de uma lista de doações.
export function sumDonationAmounts(donations: DonationRecord[]): bigint {
  return donations.reduce((total, d) => total + d.amount, BigInt(0))
}
