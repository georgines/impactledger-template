'use client'

import { useMemo, useState } from 'react'
import { Alert, Button, Group, Stack, Text } from '@mantine/core'
import { IconWallet } from '@tabler/icons-react'
import { useRouter } from 'next/navigation'
import { useWalletContext } from '@/components/providers/WalletProvider'
import { MapaDoBemPanel } from '@/components/MapaDoBemPanel'
import { getPublicProvider } from '@/services/walletService'

function errorMessage(err: unknown): string {
  const msg = err instanceof Error ? err.message : ''
  if (msg.includes('Nenhuma carteira') || msg.includes('ethereum')) {
    return 'Nenhum aplicativo de carteira digital encontrado. Instale o MetaMask para continuar.'
  }
  return 'Conexão rejeitada. Aprove a solicitação na sua carteira.'
}

export default function RootPage() {
  const { connect } = useWalletContext()
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)
  const publicProvider = useMemo(() => getPublicProvider(), [])

  async function handleConnect() {
    setError(null)
    try {
      await connect()
      router.push('/inicio')
    } catch (err) {
      setError(errorMessage(err))
    }
  }

  return (
    <Stack style={{ minHeight: '100vh' }} gap={0}>
      <Group justify="space-between" align="center" p="md">
        <div>
          <Text fw={700} size="lg" c="blue">
            EloSolidário
          </Text>
          <Text size="sm" c="dimmed">
            Plataforma de doações com transparência total. Cada centavo registrado de forma
            verificável.
          </Text>
        </div>
        <div>
          <Button leftSection={<IconWallet size={16} />} onClick={handleConnect}>
            Conectar Carteira
          </Button>
          {error && (
            <Alert color="red" mt="xs" data-testid="connect-error">
              {error}
            </Alert>
          )}
        </div>
      </Group>
      <MapaDoBemPanel provider={publicProvider} />
    </Stack>
  )
}
