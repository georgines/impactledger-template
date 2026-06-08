'use client'

import { formatEther } from 'ethers'
import { Alert, Badge, Button, Card, Group, Loader, Stack, Text, Title } from '@mantine/core'
import { IconRefresh } from '@tabler/icons-react'
import { useWallet } from '@/hooks/useWallet'
import { usePurchaseOrders } from '@/hooks/usePurchaseOrders'
import { usePurchaseManager } from '@/hooks/usePurchaseManager'
import { useSuppliers } from '@/hooks/useSuppliers'
import { useProposalCountdown } from '@/hooks/useProposalCountdown'
import { useIpfsMetadata } from '@/hooks/useIpfsMetadata'
import {
  PurchaseStatus,
  PURCHASE_STATUS_LABELS,
  PURCHASE_STATUS_COLORS,
  type Purchase,
} from '@/services/purchaseService'
import { resolveSupplierName } from '@/services/supplierService'
import { truncateAddress, formatDate } from '@/lib/format'
import { WalletRequired } from '@/components/WalletRequired'
import { PageHeader } from '@/components/PageHeader'
import { PageStateDisplay } from '@/components/PageStateDisplay'

export default function PedidosDeCompraPage() {
  const { provider, signer, address } = useWallet()
  const { orders, loading, error, refetch } = usePurchaseOrders(provider, address)
  const { suppliers } = useSuppliers(provider)
  const { openDispute, error: txError } = usePurchaseManager(signer)

  if (!address) return <WalletRequired />

  return (
    <Stack p="md">
      <PageHeader title="Pedidos de Compra" onRefresh={refetch} loading={loading} />

      <PageStateDisplay
        loading={loading && !orders.length}
        error={error}
        empty={!loading && !error && orders.length === 0}
        emptyMessage="Nenhum pedido encontrado."
        emptyTestId="empty-orders"
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
          supplierName={
            resolveSupplierName(suppliers, order.supplier) ?? truncateAddress(order.supplier)
          }
          openDispute={openDispute}
          onActionComplete={refetch}
        />
      ))}
    </Stack>
  )
}

function OrderCard({
  order,
  supplierName,
  openDispute,
  onActionComplete,
}: {
  order: Purchase
  supplierName: string
  openDispute: (id: bigint) => Promise<void>
  onActionComplete: () => void
}) {
  const deliveryCountdown = useProposalCountdown(order.deliveryDeadline)
  const confirmCountdown = useProposalCountdown(order.confirmDeadline)
  const { metadata } = useIpfsMetadata(order.descriptionHash)
  const EMPTY_HASH = '0x' + '0'.repeat(64)

  return (
    <Card data-testid={`order-card-${order.purchaseId}`} withBorder>
      <Stack gap="sm">
        <Group justify="space-between" align="flex-start">
          <Stack gap={2}>
            <Text fw={600}>{supplierName}</Text>
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
          {order.createdAt && (
            <Text size="sm" c="dimmed">
              {formatDate(order.createdAt)}
            </Text>
          )}
          {order.status === PurchaseStatus.Open && (
            <Text size="sm" c={deliveryCountdown.expired ? 'red' : 'dimmed'}>
              {deliveryCountdown.expired
                ? 'Prazo Expirado'
                : `Prazo para entrega: ${deliveryCountdown.display}`}
            </Text>
          )}
          {order.status === PurchaseStatus.Delivered && !confirmCountdown.expired && (
            <Text size="sm" data-testid={`confirm-countdown-${order.purchaseId}`} c="dimmed">
              Prazo para confirmação do recebimento: {confirmCountdown.display}
            </Text>
          )}
        </Group>

        <Group justify="flex-end">
          <OrderActions
            order={order}
            deliveryExpired={deliveryCountdown.expired}
            confirmExpired={confirmCountdown.expired}
            emptyHash={EMPTY_HASH}
            openDispute={openDispute}
            onActionComplete={onActionComplete}
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
  emptyHash,
  openDispute,
  onActionComplete,
}: {
  order: Purchase
  deliveryExpired: boolean
  confirmExpired: boolean
  emptyHash: string
  openDispute: (id: bigint) => Promise<void>
  onActionComplete: () => void
}) {
  const id = order.purchaseId

  if (order.status === PurchaseStatus.Open) {
    if (deliveryExpired) {
      return (
        <Button
          data-testid={`btn-abrir-disputa-${id}`}
          color="red"
          size="sm"
          onClick={() =>
            openDispute(id)
              .then(onActionComplete)
              .catch(() => {})
          }
        >
          Abrir Disputa
        </Button>
      )
    }
    return (
      <Text size="sm" c="dimmed">
        Aguardando entrega pelo fornecedor.
      </Text>
    )
  }

  if (order.status === PurchaseStatus.Delivered) {
    if (confirmExpired) {
      return (
        <Text size="sm" c="dimmed" data-testid={`confirm-expired-info-${id}`}>
          Prazo de confirmação expirado. O fornecedor pode abrir uma disputa.
        </Text>
      )
    }
    return (
      <Button
        data-testid={`btn-ir-recebimentos-${id}`}
        component="a"
        href="/meus-recebimentos"
        size="sm"
      >
        Ir para Recebimentos
      </Button>
    )
  }

  if (order.status === PurchaseStatus.Disputed) {
    return (
      <Button
        data-testid={`btn-ver-disputa-${id}`}
        component="a"
        href="/minhas-disputas"
        variant="light"
        color="orange"
        size="sm"
      >
        Ver Disputa
      </Button>
    )
  }

  if (order.status === PurchaseStatus.Paid) {
    return (
      <Stack gap={4}>
        <Text size="sm">Pagamento liberado.</Text>
        {order.impactProofHash && order.impactProofHash !== emptyHash && (
          <Text data-testid={`impact-proof-hash-${id}`} size="sm" ff="monospace">
            {order.impactProofHash}
          </Text>
        )}
      </Stack>
    )
  }

  if (order.status === PurchaseStatus.Refunded) {
    return (
      <Text data-testid={`refunded-info-${id}`} size="sm">
        Valor devolvido. Disputa resolvida a favor da instituição.
      </Text>
    )
  }

  return null
}
