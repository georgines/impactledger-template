'use client'

import { useCallback, useEffect, useState } from 'react'
import type { EventLog, Provider } from 'ethers'
import { getPurchaseManagerContract } from '@/services/contractService'

export interface DisputeEvidence {
  ipfsHash: string
  submittedBy: string
  blockNumber: number
  timestamp: number
}

// Hook que carrega as evidências submetidas em uma disputa com timestamp de bloco.
export function useDisputeEvidences(provider: Provider | null, purchaseId: bigint) {
  const [evidences, setEvidences] = useState<DisputeEvidence[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<Error | null>(null)

  // Busca eventos DisputeEvidenceAdded e enriquece com timestamps dos blocos.
  const load = useCallback(async () => {
    if (!provider) return
    setLoading(true)
    setError(null)
    try {
      const contract = getPurchaseManagerContract(provider)
      const filter = contract.filters.DisputeEvidenceAdded(purchaseId)
      const events = await contract.queryFilter(filter)

      const uniqueBlocks = [...new Set(events.map((e) => e.blockNumber))]
      const blocks = await Promise.all(uniqueBlocks.map((n) => provider.getBlock(n)))
      const timestampMap = new Map<number, number>()
      blocks.forEach((block, i) => {
        if (block) timestampMap.set(uniqueBlocks[i], block.timestamp)
      })

      setEvidences(
        events.map((e) => {
          const log = e as EventLog
          return {
            ipfsHash: log.args.ipfsHash as string,
            submittedBy: log.args.submittedBy as string,
            blockNumber: log.blockNumber,
            timestamp: timestampMap.get(log.blockNumber) ?? 0,
          }
        }),
      )
    } catch (err) {
      setEvidences([])
      setError(err instanceof Error ? err : new Error(String(err)))
    } finally {
      setLoading(false)
    }
  }, [provider, purchaseId])

  useEffect(() => {
    load()
  }, [load])

  return { evidences, loading, error, refetch: load }
}
