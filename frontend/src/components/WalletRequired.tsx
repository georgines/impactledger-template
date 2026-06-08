'use client'

import { Alert, Stack, Text } from '@mantine/core'
import type { ReactNode } from 'react'

interface WalletRequiredProps {
  message?: string
  children?: ReactNode
}

export function WalletRequired({
  message = 'Conecte sua carteira para continuar.',
}: WalletRequiredProps) {
  return (
    <Stack p="md">
      <Alert color="yellow">
        <Text>{message}</Text>
      </Alert>
    </Stack>
  )
}
