'use client'

import type { Provider } from 'ethers'
import { fetchPurchasesBySupplier } from '@/services/purchaseService'
import { useFetchWithRefresh } from '@/hooks/useFetchWithRefresh'

// Hook que carrega pedidos de compra recebidos por um fornecedor com suporte a refetch.
export function useSupplierOrders(provider: Provider | null, supplierAddress: string | null) {
  const {
    data: orders,
    loading,
    error,
    refetch,
  } = useFetchWithRefresh(
    () => fetchPurchasesBySupplier(provider!, supplierAddress!),
    !!provider && !!supplierAddress,
    'Erro ao carregar pedidos',
  )
  return { orders, loading, error, refetch }
}
