'use client'

import { useEffect, useState } from 'react'
import { formatEther } from 'ethers'
import { Alert, Badge, Card, Group, Loader, Progress, Stack, Text, Title } from '@mantine/core'
import { useWallet } from '@/hooks/useWallet'
import { useInstitutions } from '@/hooks/useInstitutions'
import { useSuppliers } from '@/hooks/useSuppliers'
import { fetchResolvedDisputes, type ResolvedDispute } from '@/services/purchaseService'
import { resolveInstitutionName } from '@/services/institutionService'
import { resolveSupplierName } from '@/services/supplierService'
import { truncateAddress, formatDate } from '@/lib/format'

export default function HistoricoDisputasPage() {
  const { provider } = useWallet()
  const { institutions } = useInstitutions(provider)
  const { suppliers } = useSuppliers(provider)
  const [disputes, setDisputes] = useState<ResolvedDispute[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!provider) return
    fetchResolvedDisputes(provider)
      .then(setDisputes)
      .catch(() => setDisputes([]))
      .finally(() => setLoading(false))
  }, [provider])

  if (loading) {
    return (
      <Stack p="md" align="center" py="xl">
        <Loader />
      </Stack>
    )
  }

  return (
    <Stack p="md">
      <Title order={2}>Histórico de Disputas</Title>

      {disputes.length === 0 && (
        <Alert color="gray" data-testid="empty-historico-disputas">
          <Text>Nenhuma disputa resolvida até o momento.</Text>
        </Alert>
      )}

      {disputes.map((dispute) => {
        const institutionName =
          resolveInstitutionName(institutions, dispute.institution) ??
          truncateAddress(dispute.institution)
        const supplierName =
          resolveSupplierName(suppliers, dispute.supplier) ?? truncateAddress(dispute.supplier)

        const totalWeight =
          Number(dispute.supplierVoteWeight) + Number(dispute.institutionVoteWeight)
        const supplierPct =
          totalWeight > 0 ? (Number(dispute.supplierVoteWeight) / totalWeight) * 100 : 50

        return (
          <Card
            key={String(dispute.purchaseId)}
            data-testid={`resolved-dispute-card-${dispute.purchaseId}`}
            withBorder
          >
            <Stack gap="sm">
              <Group justify="space-between" align="flex-start">
                <Stack gap={2}>
                  <Text size="sm" c="dimmed">
                    Instituição:{' '}
                    <Text span fw={600}>
                      {institutionName}
                    </Text>
                  </Text>
                  <Text size="sm" c="dimmed">
                    Fornecedor:{' '}
                    <Text span fw={600}>
                      {supplierName}
                    </Text>
                  </Text>
                </Stack>
                <Badge color={dispute.supplierWon ? 'green' : 'red'} size="lg">
                  {dispute.supplierWon ? 'Fornecedor venceu' : 'Instituição venceu'}
                </Badge>
              </Group>

              <Group gap="xl">
                <Text fw={600}>{formatEther(dispute.amount)} ETH</Text>
                <Text size="sm" c="dimmed">
                  {formatDate(dispute.resolvedAt)}
                </Text>
              </Group>

              {totalWeight > 0 && (
                <Stack gap={4}>
                  <Group justify="space-between">
                    <Text size="xs" c="dimmed">
                      Fornecedor
                    </Text>
                    <Text size="xs" c="dimmed">
                      Instituição
                    </Text>
                  </Group>
                  <Progress.Root size="sm">
                    <Progress.Section value={supplierPct} color="green" />
                    <Progress.Section value={100 - supplierPct} color="red" />
                  </Progress.Root>
                </Stack>
              )}
            </Stack>
          </Card>
        )
      })}
    </Stack>
  )
}
