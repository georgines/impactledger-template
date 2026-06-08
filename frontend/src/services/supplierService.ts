import type { EventLog, Provider } from 'ethers'
import { getPurchaseManagerContract } from '@/services/contractService'

export interface Supplier {
  address: string
  name: string
  serviceType: string
  approved: boolean
}

export function resolveSupplierName(suppliers: Supplier[], address: string): string | undefined {
  const normalized = address.toLowerCase()
  return suppliers.find((s) => s.address.toLowerCase() === normalized)?.name
}

export async function fetchSuppliers(provider: Provider): Promise<Supplier[]> {
  const contract = getPurchaseManagerContract(provider)
  const filter = contract.filters.SupplierApproved()
  const events = await contract.queryFilter(filter)

  return Promise.all(
    events.map(async (event) => {
      const log = event as EventLog
      const address = log.args.supplier as string
      const name = (log.args.name as string) ?? ''
      const serviceType = (log.args.serviceType as string) ?? ''
      const approved = Boolean(await contract.approvedSuppliers(address))

      return { address, name, serviceType, approved }
    }),
  )
}
