'use client'

import { useEffect, useState } from 'react'
import type { BrowserProvider } from 'ethers'
import {
  getGovernanceDAOContract,
  getInstitutionRegistryContract,
  getPurchaseManagerContract,
} from '@/services/contractService'

export type Role = 'operador' | 'instituicao' | 'fornecedor' | 'doador' | null
export type AuthenticatedRole = NonNullable<Role>

// Detecta o papel do endereço conectado consultando os contratos on-chain.
export function useActorRole(address: string | null, provider: BrowserProvider | null): Role {
  const [role, setRole] = useState<Role>(null)

  useEffect(() => {
    if (!address || !provider) {
      setRole(null)
      return
    }

    // Consulta contratos em paralelo e define o papel baseado na precedência operador > instituição > fornecedor > doador.
    async function detectRole() {
      const [operator, isInstitution, isSupplier] = await Promise.all([
        getGovernanceDAOContract(provider!).operator(),
        getInstitutionRegistryContract(provider!).isInstitution(address),
        getPurchaseManagerContract(provider!).approvedSuppliers(address),
      ])

      if (operator.toLowerCase() === address!.toLowerCase()) {
        setRole('operador')
        return
      }
      if (isInstitution) {
        setRole('instituicao')
        return
      }
      if (isSupplier) {
        setRole('fornecedor')
        return
      }
      setRole('doador')
    }

    detectRole()
  }, [address, provider])

  return role
}
