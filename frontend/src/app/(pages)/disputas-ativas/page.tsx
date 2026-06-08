'use client'

import { useState } from 'react'
import { formatEther } from 'ethers'
import {
  Alert,
  Badge,
  Button,
  Card,
  Divider,
  Group,
  Loader,
  Progress,
  Stack,
  Text,
  Title,
} from '@mantine/core'
import { IconRefresh } from '@tabler/icons-react'
import { useWallet } from '@/hooks/useWallet'
import { useDisputeOrders } from '@/hooks/useDisputeOrders'
import { usePurchaseManager } from '@/hooks/usePurchaseManager'
import { useProposalCountdown } from '@/hooks/useProposalCountdown'
import { useSuppliers } from '@/hooks/useSuppliers'
import { useInstitutions } from '@/hooks/useInstitutions'
import { useMyDonations } from '@/hooks/useMyDonations'
import { resolveSupplierName } from '@/services/supplierService'
import { resolveInstitutionName } from '@/services/institutionService'
import { DisputeTimeline } from '@/components/DisputeTimeline'
import { truncateAddress } from '@/lib/format'
import { WalletRequired } from '@/components/WalletRequired'
import { PageHeader } from '@/components/PageHeader'
import { PageStateDisplay } from '@/components/PageStateDisplay'
import type { Provider } from 'ethers'
import type { Purchase } from '@/services/purchaseService'
import type { Supplier } from '@/services/supplierService'
import type { Institution } from '@/services/institutionService'

interface DisputeCardProps {
  order: Purchase
  provider: Provider | null
  suppliers: Supplier[]
  institutions: Institution[]
  hasVoted: boolean
  hasDonated: boolean
  onVote: (order: Purchase, supportSupplier: boolean) => void
  onFinalize: (order: Purchase) => void
}

function DisputeCard({
  order,
  provider,
  suppliers,
  institutions,
  hasVoted,
  hasDonated,
  onVote,
  onFinalize,
}: DisputeCardProps) {
  const { display, expired } = useProposalCountdown(order.disputeDeadline)

  const totalWeight = order.supplierVoteWeight + order.institutionVoteWeight
  const supplierPct =
    totalWeight > BigInt(0) ? Number((order.supplierVoteWeight * BigInt(100)) / totalWeight) : 50

  const institutionName = resolveInstitutionName(institutions, order.institution)
  const supplierName = resolveSupplierName(suppliers, order.supplier)

  return (
    <Card data-testid={`dispute-card-${order.purchaseId}`} withBorder>
      <Stack gap="sm">
        <Group justify="space-between">
          <Stack gap={4}>
            <Text size="xs" c="dimmed">
              Instituição: {truncateAddress(order.institution)}
            </Text>
            <Text size="xs" c="dimmed">
              Fornecedor: {truncateAddress(order.supplier)}
            </Text>
            <Text fw={600}>{formatEther(order.amount)} ETH</Text>
          </Stack>
          <Stack align="flex-end" gap={4}>
            <Badge color="orange">Em Disputa</Badge>
            <Text
              size="xs"
              c={expired ? 'red' : 'dimmed'}
              data-testid={`dispute-countdown-${order.purchaseId}`}
            >
              {expired ? 'Expirada' : `Prazo: ${display}`}
            </Text>
          </Stack>
        </Group>

        <Stack gap={4}>
          <Group justify="space-between">
            <Text size="xs" c="blue" data-testid={`quorum-supplier-${order.purchaseId}`}>
              Fornecedor: {String(order.supplierVoteWeight)}
            </Text>
            <Text size="xs" c="teal" data-testid={`quorum-institution-${order.purchaseId}`}>
              Instituição: {String(order.institutionVoteWeight)}
            </Text>
          </Group>
          <Progress.Root>
            <Progress.Section value={supplierPct} color="blue" />
            <Progress.Section value={100 - supplierPct} color="teal" />
          </Progress.Root>
        </Stack>

        <Divider />

        <DisputeTimeline
          provider={provider}
          purchaseId={order.purchaseId}
          institution={order.institution}
          supplier={order.supplier}
          institutionName={institutionName}
          supplierName={supplierName}
        />

        {expired ? (
          <Group justify="flex-end">
            <Button
              data-testid={`btn-finalizar-disputa-${order.purchaseId}`}
              color="green"
              size="sm"
              onClick={() => onFinalize(order)}
            >
              Executar Veredicto
            </Button>
          </Group>
        ) : !hasVoted && hasDonated ? (
          <Group justify="flex-end">
            <Button
              data-testid={`btn-votar-fornecedor-${order.purchaseId}`}
              color="blue"
              variant="light"
              size="sm"
              onClick={() => onVote(order, true)}
            >
              Apoiar Fornecedor
            </Button>
            <Button
              data-testid={`btn-votar-instituicao-${order.purchaseId}`}
              color="teal"
              variant="light"
              size="sm"
              onClick={() => onVote(order, false)}
            >
              Apoiar Instituição
            </Button>
          </Group>
        ) : (
          <Group justify="flex-end">
            <Text size="sm" c="dimmed">
              Voto registrado.
            </Text>
          </Group>
        )}
      </Stack>
    </Card>
  )
}

export default function DisputasAtivasPage() {
  const { provider, signer, address } = useWallet()
  const { orders, loading, refetch } = useDisputeOrders(provider)
  const { voteOnDispute, finalizeDispute, error: txError } = usePurchaseManager(signer)
  const { suppliers } = useSuppliers(provider)
  const { institutions } = useInstitutions(provider)
  const { donations } = useMyDonations(address, provider)
  const hasDonated = donations.length > 0

  const [voteSuccess, setVoteSuccess] = useState(false)
  const [votedIds, setVotedIds] = useState<Set<bigint>>(new Set())

  if (!address) return <WalletRequired />

  async function handleVote(order: Purchase, supportSupplier: boolean) {
    try {
      await voteOnDispute(order.purchaseId, supportSupplier)
      setVoteSuccess(true)
      setVotedIds((prev) => new Set(prev).add(order.purchaseId))
    } finally {
      refetch()
    }
  }

  async function handleFinalize(order: Purchase) {
    try {
      await finalizeDispute(order.purchaseId)
    } finally {
      refetch()
    }
  }

  return (
    <Stack p="md">
      <PageHeader title="Disputas Ativas" onRefresh={refetch} loading={loading} />

      <PageStateDisplay
        loading={loading && !orders.length}
        empty={!loading && orders.length === 0}
        emptyMessage="Nenhuma disputa ativa no momento."
        emptyTestId="empty-disputas-ativas"
      />

      {txError && (
        <Alert color="red">
          <Text>{txError}</Text>
        </Alert>
      )}

      {voteSuccess && (
        <Alert data-testid="vote-success" color="green">
          Voto registrado com sucesso.
        </Alert>
      )}

      {orders.map((order) => (
        <DisputeCard
          key={String(order.purchaseId)}
          order={order}
          provider={provider}
          suppliers={suppliers}
          institutions={institutions}
          hasVoted={votedIds.has(order.purchaseId)}
          hasDonated={hasDonated}
          onVote={handleVote}
          onFinalize={handleFinalize}
        />
      ))}
    </Stack>
  )
}
