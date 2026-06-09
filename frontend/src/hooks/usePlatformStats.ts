'use client'

import { useEffect, useState } from 'react'
import type { Provider } from 'ethers'
import { fetchAllDonations, sumDonationAmounts } from '@/services/donationService'

// Hook que calcula o total histórico de doações para estatísticas da plataforma.
export function usePlatformStats(provider: Provider | null) {
  const [totalHistoricalDonations, setTotalHistoricalDonations] = useState<bigint | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!provider) return
    setLoading(true)
    setError(null)
    fetchAllDonations(provider)
      .then((donations) => setTotalHistoricalDonations(sumDonationAmounts(donations)))
      .catch((err) =>
        setError(err instanceof Error ? err.message : 'Erro ao carregar estatísticas'),
      )
      .finally(() => setLoading(false))
  }, [provider])

  return { totalHistoricalDonations, loading, error }
}
