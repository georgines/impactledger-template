'use client'

import { useEffect, useState } from 'react'
import type { Provider } from 'ethers'
import { fetchHasVoted } from '@/services/governanceService'

interface UseVoteStatusResult {
  hasVoted: boolean
  loading: boolean
}

// Hook que verifica se o endereço conectado já votou em uma proposta específica.
export function useVoteStatus(
  proposalId: bigint | null,
  address: string | null,
  provider: Provider | null,
): UseVoteStatusResult {
  const [hasVoted, setHasVoted] = useState(false)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!proposalId || !address || !provider) return

    setLoading(true)
    fetchHasVoted(proposalId, address, provider)
      .then(setHasVoted)
      .catch(() => {
        // falha silenciosa — hasVoted permanece false (fail-safe)
      })
      .finally(() => setLoading(false))
  }, [proposalId, address, provider])

  return { hasVoted, loading }
}
