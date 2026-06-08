'use client'

import { formatEther } from 'ethers'
import { Alert, Badge, Button, Card, Group, Loader, Stack, Text, Title } from '@mantine/core'
import { IconRefresh } from '@tabler/icons-react'
import { useWallet } from '@/hooks/useWallet'
import { useSupplierOrders } from '@/hooks/useSupplierOrders'
import { usePurchaseManager } from '@/hooks/usePurchaseManager'
import { useProposalCountdown } from '@/hooks/useProposalCountdown'
import { useIpfsMetadata } from '@/hooks/useIpfsMetadata'
import { useInstitutions } from '@/hooks/useInstitutions'
import { resolveInstitutionName } from '@/services/institutionService'
import {
  PurchaseStatus,
  PURCHASE_STATUS_LABELS,
  PURCHASE_STATUS_COLORS,
  type Purchase,
} from '@/services/purchaseService'
import type { Institution } from '@/services/institutionService'
import { truncateAddress } from '@/lib/format'
import { WalletRequired } from '@/components/WalletRequired'
import { PageHeader } from '@/components/PageHeader'
import { PageStateDisplay } from '@/components/PageStateDisplay'

export default function PedidosRecebidosPage() {
  const { provider, signer, address } = useWallet()
  const { orders, loading, refetch } = useSupplierOrders(provider, address)
  const { confirmDelivery, openDispute, error: txError } = usePurchaseManager(signer)
  const { institutions } = useInstitutions(provider)

  if (!address) return <WalletRequired />

  async function executeAndRefetch(action: () => Promise<void>) {
    try {
      await action()
    } catch {
      // erro traduzido pelo hook em txError
    } finally {
      refetch()
    }
  }

  async function handleConfirmDelivery(order: Purchase) {
    await executeAndRefetch(() => confirmDelivery(order.purchaseId))
  }

  async function handleOpenDispute(order: Purchase) {
    await executeAndRefetch(() => openDispute(order.purchaseId))
  }

  return (
    <Stack p="md">
      <PageHeader title="Pedidos Recebidos" onRefresh={refetch} loading={loading} />

      <PageStateDisplay
        loading={loading && !orders.length}
        empty={!loading && orders.length === 0}
        emptyMessage="Nenhum pedido recebido."
        emptyTestId="empty-pedidos-recebidos"
      />

      {txError && (
        <Alert color="red" data-testid="tx-error">
          <Text>{txError}</Text>
        </Alert>
      )}

      {orders.map((order) => (
        <OrderCard
          key={String(order.purchaseId)}
          order={order}
          institutions={institutions}
          onConfirmDelivery={() => handleConfirmDelivery(order)}
          onOpenDispute={() => handleOpenDispute(order)}
        />
      ))}
    </Stack>
  )
}

function OrderCard({
  order,
  institutions,
  onConfirmDelivery,
  onOpenDispute,
}: {
  order: Purchase
  institutions: Institution[]
  onConfirmDelivery: () => void
  onOpenDispute: () => void
}) {
  const deliveryCountdown = useProposalCountdown(order.deliveryDeadline)
  const confirmCountdown = useProposalCountdown(order.confirmDeadline)
  const { metadata } = useIpfsMetadata(order.descriptionHash)
  const institutionName =
    resolveInstitutionName(institutions, order.institution) ?? truncateAddress(order.institution)

  return (
    <Card data-testid={`order-card-${order.purchaseId}`} withBorder>
      <Stack gap="sm">
        <Group justify="space-between" align="flex-start">
          <Stack gap={2}>
            <Text fw={600}>{institutionName}</Text>
            {metadata && (
              <Text data-testid={`order-title-${order.purchaseId}`} size="sm" c="dimmed">
                {metadata.title}
              </Text>
            )}
            {metadata?.description && (
              <Text
                data-testid={`order-description-${order.purchaseId}`}
                size="xs"
                c="dimmed"
                lineClamp={2}
              >
                {metadata.description}
              </Text>
            )}
          </Stack>
          <Badge
            data-testid={`status-badge-${order.purchaseId}`}
            color={PURCHASE_STATUS_COLORS[order.status]}
          >
            {PURCHASE_STATUS_LABELS[order.status]}
          </Badge>
        </Group>

        <Group gap="xl">
          <Text fw={600}>{formatEther(order.amount)} ETH</Text>
          <Text size="sm" c={deliveryCountdown.expired ? 'red' : 'dimmed'}>
            {deliveryCountdown.expired
              ? 'Prazo expirado'
              : `Prazo para entrega: ${deliveryCountdown.display}`}
          </Text>
        </Group>

        <Group justify="flex-end">
          <OrderActions
            order={order}
            deliveryExpired={deliveryCountdown.expired}
            confirmExpired={confirmCountdown.expired}
            onConfirmDelivery={onConfirmDelivery}
            onOpenDispute={onOpenDispute}
          />
        </Group>
      </Stack>
    </Card>
  )
}

function OrderActions({
  order,
  deliveryExpired,
  confirmExpired,
  onConfirmDelivery,
  onOpenDispute,
}: {
  order: Purchase
  deliveryExpired: boolean
  confirmExpired: boolean
  onConfirmDelivery: () => void
  onOpenDispute: () => void
}) {
  const id = order.purchaseId

  if (order.status === PurchaseStatus.Open) {
    if (deliveryExpired) {
      return (
        <Text size="sm" c="dimmed" data-testid={`delivery-expired-info-${id}`}>
          Prazo de entrega expirado. A instituição pode abrir uma disputa.
        </Text>
      )
    }
    return (
      <Button data-testid={`btn-confirmar-entrega-${id}`} onClick={onConfirmDelivery} size="sm">
        Confirmar Entrega
      </Button>
    )
  }

  if (order.status === PurchaseStatus.Delivered) {
    if (confirmExpired) {
      return (
        <Button
          data-testid={`btn-abrir-disputa-${id}`}
          color="red"
          size="sm"
          onClick={onOpenDispute}
        >
          Abrir Disputa
        </Button>
      )
    }
    return (
      <Text size="sm" c="dimmed">
        Aguardando confirmação da instituição.
      </Text>
    )
  }

  if (order.status === PurchaseStatus.Disputed) {
    return (
      <Button component="a" href="/minhas-disputas" variant="light" color="orange" size="sm">
        Ver Minhas Disputas
      </Button>
    )
  }

  return null
}
