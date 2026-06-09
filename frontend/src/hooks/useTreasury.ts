'use client'

import { useState } from 'react'
import type { EventLog, Provider, Signer } from 'ethers'
import { getTreasuryContract, getPurchaseManagerContract } from '@/services/contractService'

export type PaymentEvent = {
  purchaseId: bigint
  amount: bigint
  blockNumber: number
  transactionHash: string
  institutionAddress: string
  timestamp: number
}

export type InstitutionBalance = {
  address: string
  available: bigint
  reserved: bigint
}

// Hook com funções de leitura do Treasury: saldos disponível, reservado, cofre e histórico.
export function useTreasury(signerOrProvider: Signer | Provider | null) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Lê o saldo disponível de uma instituição no Treasury.
  async function getAvailableBalance(address: string): Promise<bigint> {
    if (!signerOrProvider) throw new Error('Provider não disponível')
    setLoading(true)
    setError(null)
    try {
      const contract = getTreasuryContract(signerOrProvider)
      return await contract.availableBalance(address)
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erro ao ler saldo'
      setError(msg)
      throw err
    } finally {
      setLoading(false)
    }
  }

  // Lê o saldo reservado em pedidos abertos de uma instituição.
  async function getReservedBalance(address: string): Promise<bigint> {
    if (!signerOrProvider) throw new Error('Provider não disponível')
    setLoading(true)
    setError(null)
    try {
      const contract = getTreasuryContract(signerOrProvider)
      return await contract.reservedBalance(address)
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erro ao ler saldo bloqueado'
      setError(msg)
      throw err
    } finally {
      setLoading(false)
    }
  }

  // Lê o saldo total do Cofre Central acumulado de instituições removidas.
  async function getCentralVault(): Promise<bigint> {
    if (!signerOrProvider) throw new Error('Provider não disponível')
    setLoading(true)
    setError(null)
    try {
      const contract = getTreasuryContract(signerOrProvider)
      return await contract.centralVault()
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erro ao ler cofre central'
      setError(msg)
      throw err
    } finally {
      setLoading(false)
    }
  }

  // Busca histórico de pagamentos liberados a um fornecedor com timestamps de bloco.
  async function getPaymentHistory(supplierAddress: string): Promise<PaymentEvent[]> {
    if (!signerOrProvider) throw new Error('Provider não disponível')
    setLoading(true)
    setError(null)
    try {
      const provider: Provider =
        'getBlock' in signerOrProvider
          ? (signerOrProvider as Provider)
          : ((signerOrProvider as Signer).provider as Provider)
      const contract = getTreasuryContract(signerOrProvider)
      const purchaseContract = getPurchaseManagerContract(signerOrProvider)
      const filter = contract.filters.PaymentReleased(supplierAddress)
      const events = await contract.queryFilter(filter)
      return Promise.all(
        events.map(async (e) => {
          const log = e as EventLog
          const purchaseId = log.args.purchaseId as bigint
          const [block, purchase] = await Promise.all([
            provider.getBlock(log.blockNumber),
            purchaseContract.getPurchase(purchaseId),
          ])
          return {
            purchaseId,
            amount: log.args.amount as bigint,
            blockNumber: log.blockNumber,
            transactionHash: log.transactionHash,
            institutionAddress: purchase.institution as string,
            timestamp: block?.timestamp ?? 0,
          }
        }),
      )
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erro ao buscar histórico'
      setError(msg)
      throw err
    } finally {
      setLoading(false)
    }
  }

  // Busca saldos disponível e reservado de múltiplas instituições em paralelo.
  async function getInstitutionBalances(addresses: string[]): Promise<InstitutionBalance[]> {
    if (!signerOrProvider) throw new Error('Provider não disponível')
    const contract = getTreasuryContract(signerOrProvider)
    return Promise.all(
      addresses.map(async (address) => ({
        address,
        available: (await contract.availableBalance(address)) as bigint,
        reserved: (await contract.reservedBalance(address)) as bigint,
      })),
    )
  }

  return {
    getAvailableBalance,
    getReservedBalance,
    getCentralVault,
    getPaymentHistory,
    getInstitutionBalances,
    loading,
    error,
  }
}
