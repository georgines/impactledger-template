'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

export function useFetchData<T>(
  fetchFn: () => Promise<T[]>,
  enabled: boolean,
  errorMessage: string,
) {
  const [data, setData] = useState<T[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const fetchFnRef = useRef(fetchFn)
  fetchFnRef.current = fetchFn

  const load = useCallback(async () => {
    if (!enabled) return
    setLoading(true)
    setError(null)
    try {
      setData(await fetchFnRef.current())
    } catch (err) {
      setError(err instanceof Error ? err.message : errorMessage)
    } finally {
      setLoading(false)
    }
  }, [enabled, errorMessage])

  useEffect(() => {
    load()
  }, [load])

  return { data, loading, error, refetch: load }
}
