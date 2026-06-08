'use client'

import { useState } from 'react'
import {
  Alert,
  Anchor,
  Card,
  Group,
  Paper,
  SegmentedControl,
  SimpleGrid,
  Skeleton,
  Stack,
  Text,
  Title,
} from '@mantine/core'
import { IconAlertCircle } from '@tabler/icons-react'
import { formatEther } from 'ethers'
import type { Provider } from 'ethers'
import { useMapaDoBem } from '@/hooks/useMapaDoBem'
import { useInstitutions } from '@/hooks/useInstitutions'
import { useSuppliers } from '@/hooks/useSuppliers'
import { resolveInstitutionName } from '@/services/institutionService'
import { resolveSupplierName } from '@/services/supplierService'
import type { ActivityEvent, DonationActivity, PaymentActivity } from '@/services/mapaDoBemService'
import { useIpfsMetadata } from '@/hooks/useIpfsMetadata'
import { bytes32ToCid } from '@/lib/cid'
import { getIpfsGatewayUrl } from '@/services/ipfsService'
import { truncateAddress } from '@/lib/format'
import type { Institution } from '@/services/institutionService'
import type { Supplier } from '@/services/supplierService'

type FilterKind = 'all' | 'donation' | 'payment'

const EMPTY_HASH = '0x' + '0'.repeat(64)

function formatTimestamp(ts: number): string {
  if (!ts) return ''
  return new Date(ts * 1000).toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function ipfsUrl(hash: string): string | null {
  if (hash === EMPTY_HASH) return null
  return getIpfsGatewayUrl(bytes32ToCid(hash))
}

function DonationCard({
  record,
  institutions,
}: {
  record: DonationActivity
  institutions: Institution[]
}) {
  const institutionName =
    resolveInstitutionName(institutions, record.institution) ?? truncateAddress(record.institution)
  const dateLabel = formatTimestamp(record.timestamp)
  return (
    <Card withBorder padding="md" radius="md">
      <Group justify="space-between" mb="xs">
        <Text fw={600} c="green">
          Doação recebida
        </Text>
        <Text size="sm" c="dimmed">
          {dateLabel || `Bloco #${record.blockNumber.toLocaleString('pt-BR')}`}
        </Text>
      </Group>
      <Stack gap="xs">
        <Text size="sm">
          <Text span fw={500}>
            De:{' '}
          </Text>
          <Text span c="dimmed" ff="monospace">
            {truncateAddress(record.donor)}
          </Text>
        </Text>
        <Text size="sm">
          <Text span fw={500}>
            Para:{' '}
          </Text>
          <Text span c="dimmed">
            {institutionName}
          </Text>
        </Text>
        <Text size="sm">
          <Text span fw={500}>
            Valor:{' '}
          </Text>
          {formatEther(record.amount)} ETH
        </Text>
      </Stack>
    </Card>
  )
}

function PaymentCard({
  record,
  institutions,
  suppliers,
}: {
  record: PaymentActivity
  institutions: Institution[]
  suppliers: Supplier[]
}) {
  const { metadata } = useIpfsMetadata(
    record.descriptionHash !== EMPTY_HASH ? record.descriptionHash : null,
  )

  const impactUrl = ipfsUrl(record.impactProofHash)
  const institutionName =
    resolveInstitutionName(institutions, record.institution) ?? truncateAddress(record.institution)
  const supplierName =
    resolveSupplierName(suppliers, record.supplier) ?? truncateAddress(record.supplier)
  const dateLabel = formatTimestamp(record.timestamp)

  return (
    <Card withBorder padding="md" radius="md">
      <Group justify="space-between" mb="xs">
        <Text fw={600}>Pedido #{record.purchaseId.toString()}</Text>
        <Text size="sm" c="dimmed">
          {dateLabel || `Bloco #${record.blockNumber.toLocaleString('pt-BR')}`}
        </Text>
      </Group>
      <Stack gap="xs">
        <Text size="sm">
          <Text span fw={500}>
            Instituição:{' '}
          </Text>
          <Text span c="dimmed">
            {institutionName}
          </Text>
        </Text>
        <Text size="sm">
          <Text span fw={500}>
            Fornecedor:{' '}
          </Text>
          <Text span c="dimmed">
            {supplierName}
          </Text>
        </Text>
        <Text size="sm">
          <Text span fw={500}>
            Valor:{' '}
          </Text>
          {formatEther(record.amount)} ETH
        </Text>
        {metadata && (
          <Text size="sm">
            <Text span fw={500}>
              Motivo:{' '}
            </Text>
            {metadata.title}
            {metadata.description ? ` — ${metadata.description}` : ''}
          </Text>
        )}
        {impactUrl && (
          <Anchor href={impactUrl} target="_blank" rel="noopener noreferrer" size="sm">
            Prova de Impacto ↗
          </Anchor>
        )}
      </Stack>
    </Card>
  )
}

function ActivityCard({
  activity,
  institutions,
  suppliers,
}: {
  activity: ActivityEvent
  institutions: Institution[]
  suppliers: Supplier[]
}) {
  if (activity.kind === 'donation')
    return <DonationCard record={activity} institutions={institutions} />
  return <PaymentCard record={activity} institutions={institutions} suppliers={suppliers} />
}

function SummaryStats({ activities }: { activities: ActivityEvent[] }) {
  const donations = activities.filter((a): a is DonationActivity => a.kind === 'donation')
  const payments = activities.filter((a): a is PaymentActivity => a.kind === 'payment')

  const totalDoado = donations.reduce((sum, d) => sum + d.amount, BigInt(0))
  const totalPago = payments.reduce((sum, p) => sum + p.amount, BigInt(0))

  const allInstitutions = activities.map((a) => a.institution)
  const uniqueInstitutions = new Set(allInstitutions).size

  return (
    <SimpleGrid cols={{ base: 1, sm: 3 }} mb="md">
      <Paper withBorder p="md" radius="md">
        <Text size="xs" c="dimmed" tt="uppercase" fw={700}>
          Total doado
        </Text>
        <Text size="xl" fw={700} c="green">
          {parseFloat(parseFloat(formatEther(totalDoado)).toFixed(4))} ETH
        </Text>
      </Paper>
      <Paper withBorder p="md" radius="md">
        <Text size="xs" c="dimmed" tt="uppercase" fw={700}>
          Total pago (com prova)
        </Text>
        <Text size="xl" fw={700}>
          {parseFloat(parseFloat(formatEther(totalPago)).toFixed(4))} ETH
        </Text>
      </Paper>
      <Paper withBorder p="md" radius="md">
        <Text size="xs" c="dimmed" tt="uppercase" fw={700}>
          Instituições
        </Text>
        <Text size="xl" fw={700}>
          {uniqueInstitutions}
        </Text>
      </Paper>
    </SimpleGrid>
  )
}

function LoadingSkeletons() {
  return (
    <Stack>
      {[1, 2, 3].map((i) => (
        <Skeleton key={i} height={150} radius="md" data-skeleton />
      ))}
    </Stack>
  )
}

function applyFilter(activities: ActivityEvent[], filter: FilterKind): ActivityEvent[] {
  if (filter === 'all') return activities
  return activities.filter((a) => a.kind === filter)
}

const FILTER_OPTIONS = [
  { value: 'all', label: 'Todos' },
  { value: 'donation', label: 'Doações' },
  { value: 'payment', label: 'Pagamentos' },
]

interface MapaDoBemPanelProps {
  provider: Provider | null
}

export function MapaDoBemPanel({ provider }: MapaDoBemPanelProps) {
  const { activities, loading, error } = useMapaDoBem(provider)
  const { institutions } = useInstitutions(provider)
  const { suppliers } = useSuppliers(provider)
  const [filter, setFilter] = useState<FilterKind>('all')

  const visible = applyFilter(activities, filter)

  return (
    <Stack p="md">
      <div>
        <Title order={2}>Mapa do Bem</Title>
        <Text c="dimmed">Auditoria pública em tempo real</Text>
      </div>

      {loading && <LoadingSkeletons />}

      {!loading && error && (
        <Alert icon={<IconAlertCircle size={16} />} color="red" title="Erro de conexão">
          Não foi possível carregar os dados da plataforma.
        </Alert>
      )}

      {!loading && !error && (
        <>
          <SummaryStats activities={activities} />
          <SegmentedControl
            value={filter}
            onChange={(v) => setFilter(v as FilterKind)}
            data={FILTER_OPTIONS}
            data-testid="activity-filter"
          />
          {visible.length === 0 ? (
            <Text c="dimmed">Nenhuma atividade registrada ainda.</Text>
          ) : (
            <Stack>
              {visible.map((activity, i) => (
                <ActivityCard
                  key={`${activity.kind}-${activity.blockNumber}-${i}`}
                  activity={activity}
                  institutions={institutions}
                  suppliers={suppliers}
                />
              ))}
            </Stack>
          )}
        </>
      )}
    </Stack>
  )
}
