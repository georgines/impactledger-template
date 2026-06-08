'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

export function useFetchWithRefresh<T>(
  fetchFn: () => Promise<T[]>,
  enabled: boolean,
  errorMessage: string,
) {
  const [data, setData] = useState<T[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [tick, setTick] = useState(0)
  const fetchFnRef = useRef(fetchFn)
  fetchFnRef.current = fetchFn

  useEffect(() => {
    if (!enabled) return
    setLoading(true)
    setError(null)
    fetchFnRef
      .current()
      .then(setData)
      .catch((err: unknown) => setError(err instanceof Error ? err.message : errorMessage))
      .finally(() => setLoading(false))
  }, [enabled, tick, errorMessage])

  const refetch = useCallback(() => setTick((t) => t + 1), [])

  return { data, loading, error, refetch }
}
