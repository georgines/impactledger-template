'use client'

import { useState, useEffect } from 'react'
import type { Provider } from 'ethers'
import { fetchAllActivity, type ActivityEvent } from '@/services/mapaDoBemService'
import { getPublicProvider } from '@/services/walletService'

export interface UseMapaDoBemResult {
  activities: ActivityEvent[]
  loading: boolean
  error: string | null
}

export function useMapaDoBem(provider: Provider | null): UseMapaDoBemResult {
  const [activities, setActivities] = useState<ActivityEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const resolvedProvider = provider ?? getPublicProvider()
    setLoading(true)
    setError(null)
    fetchAllActivity(resolvedProvider)
      .then(setActivities)
      .catch((err) => {
        setError(err instanceof Error ? err.message : 'Erro ao carregar dados da plataforma')
      })
      .finally(() => setLoading(false))
  }, [provider])

  return { activities, loading, error }
}
