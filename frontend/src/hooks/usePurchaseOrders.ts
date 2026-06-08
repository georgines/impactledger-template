'use client'

import type { Provider } from 'ethers'
import { fetchPurchasesByInstitution } from '@/services/purchaseService'
import { useFetchWithRefresh } from '@/hooks/useFetchWithRefresh'

export function usePurchaseOrders(provider: Provider | null, institutionAddress: string | null) {
  const {
    data: orders,
    loading,
    error,
    refetch,
  } = useFetchWithRefresh(
    () => fetchPurchasesByInstitution(provider!, institutionAddress!),
    !!provider && !!institutionAddress,
    'Erro ao carregar pedidos',
  )
  return { orders, loading, error, refetch }
}
