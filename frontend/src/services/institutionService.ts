import type { EventLog, Provider } from 'ethers'
import { getInstitutionRegistryContract } from '@/services/contractService'

// Espelha exatamente o enum Status do contrato InstitutionRegistry.
export enum InstitutionStatus {
  Inactive = 0,
  Active = 1,
  Paused = 2,
  Removed = 3,
}

export interface Institution {
  address: string
  name: string
  areaOfWork: string
  status: InstitutionStatus
}

export function resolveInstitutionName(
  institutions: Institution[],
  address: string,
): string | undefined {
  const normalized = address.toLowerCase()
  return institutions.find((i) => i.address.toLowerCase() === normalized)?.name
}

export async function fetchInstitutions(provider: Provider): Promise<Institution[]> {
  const contract = getInstitutionRegistryContract(provider)
  const filter = contract.filters.InstitutionRegistered()
  const events = await contract.queryFilter(filter)

  return Promise.all(
    events.map(async (event) => {
      const log = event as EventLog
      const address = log.args.institution as string
      const name = (log.args.name as string) ?? ''
      const areaOfWork = (log.args.areaOfWork as string) ?? ''
      const statusRaw = Number(await contract.statusOf(address))

      return {
        address,
        name,
        areaOfWork,
        status: statusRaw as InstitutionStatus,
      }
    }),
  )
}
