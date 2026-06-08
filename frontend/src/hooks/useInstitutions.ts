'use client'

import type { Provider } from 'ethers'
import { fetchInstitutions } from '@/services/institutionService'
import { useFetchData } from '@/hooks/useFetchData'

export function useInstitutions(provider: Provider | null) {
  const {
    data: institutions,
    loading,
    error,
    refetch,
  } = useFetchData(() => fetchInstitutions(provider!), !!provider, 'Erro ao carregar instituições')
  return { institutions, loading, error, refetch }
}
