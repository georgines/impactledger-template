'use client'

import { MantineProvider } from '@mantine/core'
import { WalletProvider } from './WalletProvider'

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <MantineProvider>
      <WalletProvider>{children}</WalletProvider>
    </MantineProvider>
  )
}
