'use client'

import { createContext, useCallback, useContext, useEffect, useState } from 'react'
import type { BrowserProvider, JsonRpcSigner } from 'ethers'
import { connectWallet } from '@/services/walletService'
import { useActorRole, type Role } from '@/hooks/useActorRole'

export interface WalletContextValue {
  address: string | null
  provider: BrowserProvider | null
  signer: JsonRpcSigner | null
  role: Role
  connect: () => Promise<void>
  disconnect: () => void
}

export const WalletContext = createContext<WalletContextValue | null>(null)

type EthereumProvider = {
  on?: (event: string, handler: (...args: unknown[]) => void) => void
  removeListener?: (event: string, handler: (...args: unknown[]) => void) => void
}

export function WalletProvider({ children }: { children: React.ReactNode }) {
  const [address, setAddress] = useState<string | null>(null)
  const [provider, setProvider] = useState<BrowserProvider | null>(null)
  const [signer, setSigner] = useState<JsonRpcSigner | null>(null)

  const role = useActorRole(address, provider)

  const disconnect = useCallback(() => {
    setAddress(null)
    setProvider(null)
    setSigner(null)
  }, [])

  const connect = useCallback(async () => {
    const p = await connectWallet()
    const s = await p.getSigner()
    const addr = await s.getAddress()
    setProvider(p)
    setSigner(s)
    setAddress(addr)
  }, [])

  useEffect(() => {
    async function tryAutoConnect() {
      if (!window.ethereum) return
      try {
        const accounts = (await window.ethereum.request({ method: 'eth_accounts' })) as string[]
        if (accounts.length > 0) await connect()
      } catch {
        // carteira não aprovada — aguarda ação do usuário
      }
    }
    tryAutoConnect()
  }, [connect])

  useEffect(() => {
    const eth = (window as Window & { ethereum?: EthereumProvider }).ethereum
    if (!eth?.on) return

    const handleAccountsChanged = (accounts: unknown) => {
      const list = accounts as string[]
      if (list.length === 0) disconnect()
      else connect()
    }

    const handleChainChanged = () => connect()

    eth.on('accountsChanged', handleAccountsChanged)
    eth.on('chainChanged', handleChainChanged)

    return () => {
      eth.removeListener?.('accountsChanged', handleAccountsChanged)
      eth.removeListener?.('chainChanged', handleChainChanged)
    }
  }, [connect, disconnect])

  return (
    <WalletContext.Provider value={{ address, provider, signer, role, connect, disconnect }}>
      {children}
    </WalletContext.Provider>
  )
}

export function useWalletContext(): WalletContextValue {
  const ctx = useContext(WalletContext)
  if (!ctx) throw new Error('useWalletContext deve ser usado dentro de WalletProvider')
  return ctx
}
