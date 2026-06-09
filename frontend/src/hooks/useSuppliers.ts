'use client'

import type { Provider } from 'ethers'
import { fetchSuppliers } from '@/services/supplierService'
import { useFetchData } from '@/hooks/useFetchData'

// Hook que carrega a lista de fornecedores aprovados on-chain.
export function useSuppliers(provider: Provider | null) {
  const {
    data: suppliers,
    loading,
    error,
    refetch,
  } = useFetchData(() => fetchSuppliers(provider!), !!provider, 'Erro ao carregar fornecedores')
  return { suppliers, loading, error, refetch }
}
