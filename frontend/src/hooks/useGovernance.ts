'use client'

import { useState } from 'react'
import type { Signer, Provider } from 'ethers'
import { getGovernanceDAOContract } from '@/services/contractService'
import { translateContractError } from '@/services/contractErrors'
import { translateFinalizeError } from '@/services/governanceService'

export interface ProposalInput {
  kind: number
  target: string
  name: string
  metadata: string
  purchaseId: bigint
  disputeVerdict: boolean
}

export function useGovernance(signerOrProvider: Signer | Provider | null) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function propose(input: ProposalInput): Promise<void> {
    if (!signerOrProvider) throw new Error('Signer/Provider não disponível')
    setLoading(true)
    setError(null)
    try {
      const contract = getGovernanceDAOContract(signerOrProvider)
      const tx = await contract.propose(input.kind, input.target, input.name, input.metadata)
      await tx.wait()
    } catch (err) {
      setError(translateContractError(err))
      throw err
    } finally {
      setLoading(false)
    }
  }

  async function vote(proposalId: bigint, support: boolean): Promise<void> {
    if (!signerOrProvider) throw new Error('Signer não disponível')
    const contract = getGovernanceDAOContract(signerOrProvider)
    const tx = await contract.vote(proposalId, support)
    await tx.wait()
  }

  async function finalize(proposalId: bigint, name: string, metadata: string): Promise<void> {
    if (!signerOrProvider) throw new Error('Signer não disponível')
    setLoading(true)
    setError(null)
    try {
      const contract = getGovernanceDAOContract(signerOrProvider)
      const tx = await contract.finalize(proposalId, name, metadata)
      await tx.wait()
    } catch (err) {
      setError(translateFinalizeError(err))
      throw err
    } finally {
      setLoading(false)
    }
  }

  return {
    propose,
    vote,
    finalize,
    loading,
    error,
  }
}
