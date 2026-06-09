'use client'

import { useState } from 'react'
import type { JsonRpcSigner } from 'ethers'
import { getTreasuryContract } from '@/services/contractService'
import { translateContractError } from '@/services/contractErrors'

// Hook para enviar doação em ETH a uma instituição via Treasury.
export function useDonation(signer: JsonRpcSigner | null) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Envia transação de doação e aguarda confirmação.
  async function donate(institutionAddress: string, value: bigint): Promise<void> {
    if (!signer) throw new Error('Signer não disponível')
    setLoading(true)
    setError(null)
    try {
      const contract = getTreasuryContract(signer)
      const tx = await contract.donate(institutionAddress, { value })
      await tx.wait()
    } catch (err) {
      setError(translateContractError(err))
      throw err
    } finally {
      setLoading(false)
    }
  }

  return { donate, loading, error }
}
