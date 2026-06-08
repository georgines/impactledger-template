'use client'

import { useState } from 'react'
import type { Signer } from 'ethers'
import { getGovernanceDAOContract } from '@/services/contractService'
import { translateContractError } from '@/services/contractErrors'

export function useBootstrapRegister(signer: Signer | null) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function bootstrapRegister(
    address: string,
    name: string,
    areaOfWork: string,
  ): Promise<void> {
    if (!signer) throw new Error('Signer não disponível')
    setLoading(true)
    setError(null)
    try {
      const contract = getGovernanceDAOContract(signer)
      const tx = await contract.bootstrapRegister(address, name, areaOfWork)
      await tx.wait()
    } catch (err) {
      const message = translateContractError(err)
      setError(message)
      throw err
    } finally {
      setLoading(false)
    }
  }

  return { bootstrapRegister, loading, error }
}
