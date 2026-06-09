'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import type { Provider } from 'ethers'
import { fetchProposals, fetchSingleProposal, type Proposal } from '@/services/governanceService'

// Hook que carrega a lista de propostas e suporta atualização individual sem recarregar tudo.
export function useProposalList(provider: Provider | null) {
  const [proposals, setProposals] = useState<Proposal[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const proposalsRef = useRef<Proposal[]>([])

  // Busca todas as propostas e atualiza o estado local e a ref.
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

  // Atualiza os dados de uma proposta específica preservando name/metadata do evento original.
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
