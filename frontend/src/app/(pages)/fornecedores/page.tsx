'use client'

import {
  Alert,
  Badge,
  Card,
  Center,
  Group,
  Loader,
  Modal,
  SimpleGrid,
  Stack,
  Text,
  Title,
} from '@mantine/core'
import { useState } from 'react'
import { useWallet } from '@/hooks/useWallet'
import { useSuppliers } from '@/hooks/useSuppliers'
import type { Supplier } from '@/services/supplierService'
import { truncateAddress } from '@/lib/format'
import { resolveAreaColor, getInitials } from '@/lib/display'
import { PageStateDisplay } from '@/components/PageStateDisplay'
import { WalletRequired } from '@/components/WalletRequired'

export default function FornecedoresPage() {
  const { provider } = useWallet()
  const { suppliers, loading, error } = useSuppliers(provider)
  const [selected, setSelected] = useState<Supplier | null>(null)

  if (!provider)
    return <WalletRequired message="Conecte sua carteira para visualizar os fornecedores." />

  return (
    <Stack p="md" gap="xl">
      <Title order={2}>Fornecedores</Title>

      <PageStateDisplay
        loading={loading}
        error={!loading ? (error ?? null) : null}
        empty={!loading && !error && suppliers.length === 0}
        emptyMessage="Nenhum fornecedor aprovado na plataforma."
        emptyTestId="empty-suppliers"
      />

      <Center>
        <SimpleGrid cols={{ base: 1, sm: 2, md: 3, lg: 4 }} spacing="lg" w="100%" maw={1200}>
          {suppliers.map((supplier) => {
            const color = resolveAreaColor(supplier.serviceType)
            const revoked = !supplier.approved

            return (
              <Card
                key={supplier.address}
                shadow="sm"
                radius="md"
                withBorder
                padding={0}
                onClick={() => setSelected(supplier)}
                style={{ cursor: 'pointer', opacity: revoked ? 0.65 : 1 }}
                data-testid={`supplier-card-${supplier.address}`}
              >
                <Center
                  bg={color}
                  h={120}
                  style={{ borderRadius: 'var(--mantine-radius-md) var(--mantine-radius-md) 0 0' }}
                >
                  <Text size="3rem" fw={700} c="white">
                    {getInitials(supplier.name)}
                  </Text>
                </Center>

                <Stack p="md" gap="xs">
                  <Group justify="space-between" align="flex-start">
                    <Text fw={600} size="md" style={{ flex: 1 }}>
                      {supplier.name}
                    </Text>
                    <Badge color={revoked ? 'red' : 'green'} variant="light" size="sm">
                      {revoked ? 'Revogado' : 'Aprovado'}
                    </Badge>
                  </Group>

                  <Badge color={color} variant="dot" size="sm">
                    {supplier.serviceType}
                  </Badge>

                  <Text size="xs" c="dimmed" ff="monospace" title={supplier.address}>
                    {truncateAddress(supplier.address)}
                  </Text>
                </Stack>
              </Card>
            )
          })}
        </SimpleGrid>
      </Center>

      <Modal
        opened={!!selected}
        onClose={() => setSelected(null)}
        title={selected?.name ?? ''}
        centered
      >
        {selected && (
          <Stack gap="xs">
            <Group gap="xs">
              <Badge color={resolveAreaColor(selected.serviceType)} variant="dot">
                {selected.serviceType}
              </Badge>
              <Badge color={selected.approved ? 'green' : 'red'} variant="light">
                {selected.approved ? 'Aprovado' : 'Revogado'}
              </Badge>
            </Group>
            <Text size="sm" c="dimmed">
              Identificador digital
            </Text>
            <Text size="sm" ff="monospace">
              {selected.address}
            </Text>
          </Stack>
        )}
      </Modal>
    </Stack>
  )
}
