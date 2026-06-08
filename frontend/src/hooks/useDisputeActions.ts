'use client'

import { useState } from 'react'
import type { Signer } from 'ethers'
import { getPurchaseManagerContract } from '@/services/contractService'
import { translateContractError } from '@/services/contractErrors'

type Contract = ReturnType<typeof getPurchaseManagerContract>
type TxResult = { wait(): Promise<unknown> }

export function useDisputeActions(signer: Signer | null) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function execute(action: (c: Contract) => Promise<TxResult>): Promise<void> {
    if (!signer) throw new Error('Signer não disponível')
    setLoading(true)
    setError(null)
    try {
      const contract = getPurchaseManagerContract(signer)
      const tx = await action(contract)
      await tx.wait()
    } catch (err) {
      setError(translateContractError(err))
      throw err
    } finally {
      setLoading(false)
    }
  }

  async function openDispute(purchaseId: bigint): Promise<void> {
    await execute((c) => c.openDispute(purchaseId))
  }

  async function addDisputeEvidence(purchaseId: bigint, ipfsHash: string): Promise<void> {
    await execute((c) => c.addDisputeEvidence(purchaseId, ipfsHash))
  }

  async function voteOnDispute(purchaseId: bigint, supportSupplier: boolean): Promise<void> {
    await execute((c) => c.voteOnDispute(purchaseId, supportSupplier))
  }

  async function finalizeDispute(purchaseId: bigint): Promise<void> {
    await execute((c) => c.finalizeDispute(purchaseId))
  }

  return { openDispute, addDisputeEvidence, voteOnDispute, finalizeDispute, loading, error }
}
