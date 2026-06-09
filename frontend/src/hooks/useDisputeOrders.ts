'use client'

import type { Provider } from 'ethers'
import { fetchDisputedPurchases } from '@/services/purchaseService'
import { useFetchWithRefresh } from '@/hooks/useFetchWithRefresh'

// Hook que carrega pedidos atualmente em disputa.
export function useDisputeOrders(provider: Provider | null) {
  const {
    data: orders,
    loading,
    error,
    refetch,
  } = useFetchWithRefresh(
    () => fetchDisputedPurchases(provider!),
    !!provider,
    'Erro ao carregar disputas',
  )
  return { orders, loading, error, refetch }
}
