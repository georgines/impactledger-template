'use client'

import { Center, Loader } from '@mantine/core'
import { redirect, usePathname } from 'next/navigation'
import { useWalletContext } from '@/components/providers/WalletProvider'
import { WalletRequired } from '@/components/WalletRequired'
import { ROUTE_ROLES } from '@/lib/routeRoles'

export function RouteGuard({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const { address, role } = useWalletContext()

  if (address === null) {
    return <WalletRequired />
  }

  if (role === null) {
    return (
      <Center h="100%">
        <Loader />
      </Center>
    )
  }

  const allowedRoles = ROUTE_ROLES[pathname]

  if (allowedRoles !== undefined && !allowedRoles.includes(role)) {
    redirect('/inicio')
    return null
  }

  return <>{children}</>
}
