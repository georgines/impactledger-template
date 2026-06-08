'use client'

import { useWalletContext } from '@/components/providers/WalletProvider'
import { MapaDoBemPanel } from '@/components/MapaDoBemPanel'

export default function DashboardPage() {
  const { provider } = useWalletContext()
  return <MapaDoBemPanel provider={provider} />
}
