'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import type { Provider } from 'ethers'
import { fetchProposals, fetchSingleProposal, type Proposal } from '@/services/governanceService'

export function useProposalList(provider: Provider | null) {
  const [proposals, setProposals] = useState<Proposal[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const proposalsRef = useRef<Proposal[]>([])

  const load = useCallback(async () => {
    if (!provider) return
    setLoading(true)
    setError(null)
    try {
      const data = await fetchProposals(provider)
      proposalsRef.current = data
      setProposals(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao carregar propostas')
    } finally {
      setLoading(false)
    }
  }, [provider])

  const refreshSingleProposal = useCallback(
    async (proposalId: bigint) => {
      if (!provider) return
      const existing = proposalsRef.current.find((p) => p.proposalId === proposalId)
      if (!existing) return
      try {
        const updated = await fetchSingleProposal(proposalId, provider, {
          name: existing.name,
          metadata: existing.metadata,
        })
        const next = proposalsRef.current.map((p) => (p.proposalId === proposalId ? updated : p))
        proposalsRef.current = next
        setProposals(next)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Erro ao atualizar proposta')
        throw err
      }
    },
    [provider],
  )

  useEffect(() => {
    load()
  }, [load])

  return { proposals, loading, error, refetch: load, refreshSingleProposal }
}
