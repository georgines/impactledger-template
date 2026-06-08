import type { EventLog, Log, Provider } from 'ethers'
import { getTreasuryContract } from '@/services/contractService'

export interface DonationRecord {
  institution: string
  amount: bigint
  txHash: string
  blockNumber: number
}

function mapDonationEvent(event: Log): DonationRecord {
  const log = event as EventLog
  return {
    institution: log.args.institution as string,
    amount: log.args.amount as bigint,
    txHash: log.transactionHash,
    blockNumber: log.blockNumber,
  }
}

export async function fetchMyDonations(
  donorAddress: string,
  provider: Provider,
): Promise<DonationRecord[]> {
  const contract = getTreasuryContract(provider)
  const events = await contract.queryFilter(contract.filters.DonationReceived(donorAddress))
  return events.map(mapDonationEvent)
}

export async function fetchAllDonations(provider: Provider): Promise<DonationRecord[]> {
  const contract = getTreasuryContract(provider)
  const events = await contract.queryFilter(contract.filters.DonationReceived())
  return events.map(mapDonationEvent)
}

export function sumDonationAmounts(donations: DonationRecord[]): bigint {
  return donations.reduce((total, d) => total + d.amount, BigInt(0))
}
