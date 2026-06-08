'use client'

import { useEffect, useState } from 'react'
import type { Provider } from 'ethers'
import { fetchIsBootstrapped } from '@/services/governanceService'

export function useBootstrapStatus(provider: Provider | null) {
  const [isBootstrapped, setIsBootstrapped] = useState(false)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!provider) return

    setLoading(true)
    fetchIsBootstrapped(provider)
      .then(setIsBootstrapped)
      .catch(() => setIsBootstrapped(false))
      .finally(() => setLoading(false))
  }, [provider])

  return { isBootstrapped, loading }
}
