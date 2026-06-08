'use client'

import type { Provider } from 'ethers'
import { fetchDisputedPurchases } from '@/services/purchaseService'
import { useFetchWithRefresh } from '@/hooks/useFetchWithRefresh'

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
