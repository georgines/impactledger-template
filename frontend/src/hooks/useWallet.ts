'use client'

import { useContext } from 'react'
import { WalletContext } from '@/components/providers/WalletProvider'
import type { WalletContextValue } from '@/components/providers/WalletProvider'

// Hook que acessa o contexto de carteira; lança erro se usado fora do WalletProvider.
export function useWallet(): WalletContextValue {
  const ctx = useContext(WalletContext)
  if (!ctx) throw new Error('useWallet deve ser usado dentro de WalletProvider')
  return ctx
}
