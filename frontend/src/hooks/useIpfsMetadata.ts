'use client'

import { useEffect, useState } from 'react'
import { fetchFromIPFSByBytes32, type IpfsMetadata } from '@/services/ipfsService'

const EMPTY_HASH = '0x' + '0'.repeat(64)

const cache = new Map<string, IpfsMetadata>()
const inflight = new Map<string, Promise<IpfsMetadata>>()

export function useIpfsMetadata(bytes32: string | null) {
  const [metadata, setMetadata] = useState<IpfsMetadata | null>(
    bytes32 ? (cache.get(bytes32) ?? null) : null,
  )
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!bytes32 || bytes32 === EMPTY_HASH) return
    if (cache.has(bytes32)) {
      setMetadata(cache.get(bytes32)!)
      return
    }
    setLoading(true)
    if (!inflight.has(bytes32)) {
      const promise = fetchFromIPFSByBytes32(bytes32).then((data) => {
        cache.set(bytes32, data)
        inflight.delete(bytes32)
        return data
      })
      inflight.set(bytes32, promise)
    }
    inflight
      .get(bytes32)!
      .then((data) => setMetadata(data))
      .catch(() => setMetadata(null))
      .finally(() => setLoading(false))
  }, [bytes32])

  return { metadata, loading }
}
