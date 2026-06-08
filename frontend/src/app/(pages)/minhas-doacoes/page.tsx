'use client'

import { Alert, Badge, Button, Card, Group, Loader, Stack, Text, Title } from '@mantine/core'
import { IconRefresh } from '@tabler/icons-react'
import { formatEther } from 'ethers'
import { useWallet } from '@/hooks/useWallet'
import { useMyDonations } from '@/hooks/useMyDonations'
import { useInstitutions } from '@/hooks/useInstitutions'
import { resolveInstitutionName } from '@/services/institutionService'
import { truncateAddress } from '@/lib/format'
import { WalletRequired } from '@/components/WalletRequired'
import { PageHeader } from '@/components/PageHeader'
import { PageStateDisplay } from '@/components/PageStateDisplay'

export default function MinhasDoacoesPage() {
  const { provider, address } = useWallet()
  const { donations, loading, error, refetch } = useMyDonations(address, provider)
  const { institutions } = useInstitutions(provider)

  if (!provider || !address)
    return <WalletRequired message="Conecte sua carteira para ver suas doações." />

  return (
    <Stack p="md">
      <PageHeader title="Minhas Doações" onRefresh={refetch} loading={loading} />

      <PageStateDisplay
        loading={loading && !donations.length}
        error={error}
        empty={!loading && !error && donations.length === 0}
        emptyMessage="Você ainda não realizou nenhuma doação."
        emptyTestId="empty-donations"
      />

      {donations.map((donation, idx) => (
        <Card key={`${donation.txHash}-${idx}`} shadow="sm" padding="md" radius="md" withBorder>
          <Group justify="space-between" align="flex-start">
            <Stack gap="xs">
              <Group gap="xs">
                <Text size="sm" c="dimmed" fw={500}>
                  Instituição:
                </Text>
                <Text size="sm" title={donation.institution}>
                  {resolveInstitutionName(institutions, donation.institution) ??
                    truncateAddress(donation.institution)}
                </Text>
              </Group>
              <Group gap="xs">
                <Text size="sm" c="dimmed" fw={500}>
                  Bloco:
                </Text>
                <Text size="sm">#{donation.blockNumber}</Text>
              </Group>
            </Stack>
            <Badge color="green" variant="light" size="lg">
              {formatEther(donation.amount)} ETH
            </Badge>
          </Group>
        </Card>
      ))}
    </Stack>
  )
}
