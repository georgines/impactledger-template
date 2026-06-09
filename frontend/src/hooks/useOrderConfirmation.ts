'use client'

import { useState } from 'react'
import type { Signer } from 'ethers'
import { getPurchaseManagerContract } from '@/services/contractService'
import { translateContractError } from '@/services/contractErrors'

type Contract = ReturnType<typeof getPurchaseManagerContract>
type TxResult = { wait(): Promise<unknown> }

// Hook com ações de confirmação de pedido: entrega, recebimento e prova de impacto.
export function useOrderConfirmation(signer: Signer | null) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Wrapper que executa ação no contrato com gestão de loading e erro.
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

  // Confirma a entrega de um pedido (chamada pelo fornecedor).
  async function confirmDelivery(purchaseId: bigint): Promise<void> {
    await execute((c) => c.confirmDelivery(purchaseId))
  }

  // Confirma o recebimento de um pedido (chamada pela instituição).
  async function confirmReceipt(purchaseId: bigint): Promise<void> {
    await execute((c) => c.confirmReceipt(purchaseId))
  }

  // Submete prova de impacto e libera pagamento ao fornecedor.
  async function submitImpactProof(purchaseId: bigint, ipfsHash: string): Promise<void> {
    await execute((c) => c.submitImpactProof(purchaseId, ipfsHash))
  }

  // Confirma recebimento e submete prova de impacto em uma única transação.
  async function confirmReceiptAndSubmitProof(purchaseId: bigint, ipfsHash: string): Promise<void> {
    await execute((c) => c.confirmReceiptAndSubmitProof(purchaseId, ipfsHash))
  }

  return {
    confirmDelivery,
    confirmReceipt,
    submitImpactProof,
    confirmReceiptAndSubmitProof,
    loading,
    error,
  }
}
