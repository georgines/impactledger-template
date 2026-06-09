'use client'

import { useState } from 'react'
import type { Signer } from 'ethers'
import { getPurchaseManagerContract } from '@/services/contractService'
import { translateContractError } from '@/services/contractErrors'

type Contract = ReturnType<typeof getPurchaseManagerContract>
type TxResult = { wait(): Promise<unknown> }

// Hook com ações de disputa: abrir, adicionar evidência, votar e finalizar.
export function useDisputeActions(signer: Signer | null) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Wrapper interno que executa uma ação no contrato com gestão de loading e erro.
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

  // Abre uma disputa para um pedido com prazo expirado.
  async function openDispute(purchaseId: bigint): Promise<void> {
    await execute((c) => c.openDispute(purchaseId))
  }

  // Submete hash IPFS de evidência durante o período de disputa.
  async function addDisputeEvidence(purchaseId: bigint, ipfsHash: string): Promise<void> {
    await execute((c) => c.addDisputeEvidence(purchaseId, ipfsHash))
  }

  // Registra voto de doador em uma disputa ativa.
  async function voteOnDispute(purchaseId: bigint, supportSupplier: boolean): Promise<void> {
    await execute((c) => c.voteOnDispute(purchaseId, supportSupplier))
  }

  // Finaliza a apuração de uma disputa após quórum ou prazo encerrado.
  async function finalizeDispute(purchaseId: bigint): Promise<void> {
    await execute((c) => c.finalizeDispute(purchaseId))
  }

  return { openDispute, addDisputeEvidence, voteOnDispute, finalizeDispute, loading, error }
}
