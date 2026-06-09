'use client'

import { useState, useEffect } from 'react'
import type { Signer } from 'ethers'
import { useGovernance } from '@/hooks/useGovernance'
import { translateFinalizeError, type Proposal } from '@/services/governanceService'

interface UseFinalizeProposalResult {
  finalizing: boolean
  finalizeError: string | null
  handleFinalize: () => Promise<void>
}

// Hook para finalizar a apuração de uma proposta e notificar o componente pai.
export function useFinalizeProposal(
  signer: Signer | null,
  proposal: Pick<Proposal, 'proposalId' | 'name' | 'metadata' | 'status'>,
  onFinalized: () => void,
): UseFinalizeProposalResult {
  const { finalize } = useGovernance(signer)
  const [finalizing, setFinalizing] = useState(false)
  const [finalizeError, setFinalizeError] = useState<string | null>(null)

  // Limpa erro obsoleto quando a proposta muda (proposalId ou status).
  useEffect(() => {
    setFinalizeError(null)
  }, [proposal.proposalId, proposal.status])

  // Executa finalize no contrato e chama onFinalized em caso de sucesso.
  async function handleFinalize() {
    setFinalizing(true)
    setFinalizeError(null)
    try {
      await finalize(proposal.proposalId, proposal.name, proposal.metadata)
      onFinalized()
    } catch (err) {
      setFinalizeError(translateFinalizeError(err))
    } finally {
      setFinalizing(false)
    }
  }

  return { finalizing, finalizeError, handleFinalize }
}
