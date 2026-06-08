'use client'

import type { Provider } from 'ethers'
import { fetchMyDonations } from '@/services/donationService'
import { useFetchData } from '@/hooks/useFetchData'

export function useMyDonations(address: string | null, provider: Provider | null) {
  const {
    data: donations,
    loading,
    error,
    refetch,
  } = useFetchData(
    () => fetchMyDonations(address!, provider!),
    !!provider && !!address,
    'Erro ao carregar histórico de doações',
  )
  return { donations, loading, error, refetch }
}
