'use client'

import { useState } from 'react'
import type { Signer } from 'ethers'
import { getPurchaseManagerContract } from '@/services/contractService'
import { translateContractError } from '@/services/contractErrors'

type Contract = ReturnType<typeof getPurchaseManagerContract>
type TxResult = { wait(): Promise<unknown> }

// Hook para criação de pedidos de compra via PurchaseManager.
export function useOrderCreation(signer: Signer | null) {
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

  // Abre um novo pedido de compra on-chain para o fornecedor indicado.
  async function createOrder(
    supplier: string,
    amount: bigint,
    deadline: bigint,
    descriptionHash: string,
  ): Promise<void> {
    await execute((c) => c.openPurchase(supplier, amount, deadline, descriptionHash))
  }

  return { createOrder, loading, error }
}
