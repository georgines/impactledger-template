'use client'

import { useState } from 'react'
import type { Signer } from 'ethers'
import { useGovernance } from '@/hooks/useGovernance'
import { translateVoteError, type Proposal } from '@/services/governanceService'

interface UseVoteModalResult {
  isOpen: boolean
  voting: boolean
  voteError: string | null
  open: () => void
  close: () => void
  submitVote: (support: boolean) => Promise<void>
}

// Hook que gerencia o estado e ações do modal de votação em uma proposta.
export function useVoteModal(
  signer: Signer | null,
  proposal: Pick<Proposal, 'proposalId'>,
  onVoted: (proposalId: bigint) => void,
): UseVoteModalResult {
  const { vote } = useGovernance(signer)
  const [isOpen, setIsOpen] = useState(false)
  const [voting, setVoting] = useState(false)
  const [voteError, setVoteError] = useState<string | null>(null)

  // Abre o modal de votação e limpa erros anteriores.
  function open() {
    setVoteError(null)
    setIsOpen(true)
  }

  // Fecha o modal de votação e limpa erros.
  function close() {
    setIsOpen(false)
    setVoteError(null)
  }

  // Envia o voto on-chain, fecha o modal e notifica o componente pai em caso de sucesso.
  async function submitVote(support: boolean) {
    setVoting(true)
    setVoteError(null)
    try {
      await vote(proposal.proposalId, support)
      close()
      onVoted(proposal.proposalId)
    } catch (err) {
      setVoteError(translateVoteError(err))
    } finally {
      setVoting(false)
    }
  }

  return { isOpen, voting, voteError, open, close, submitVote }
}
