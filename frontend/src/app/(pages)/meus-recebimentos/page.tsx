'use client'

import { useState } from 'react'
import { formatEther } from 'ethers'
import {
  Alert,
  Anchor,
  Badge,
  Button,
  Card,
  Group,
  Loader,
  Stack,
  Text,
  Title,
} from '@mantine/core'
import { IconRefresh } from '@tabler/icons-react'
import { useWallet } from '@/hooks/useWallet'
import { usePurchaseOrders } from '@/hooks/usePurchaseOrders'
import { usePurchaseManager } from '@/hooks/usePurchaseManager'
import { useIpfsUpload } from '@/hooks/useIpfsUpload'
import { useSuppliers } from '@/hooks/useSuppliers'
import { useProposalCountdown } from '@/hooks/useProposalCountdown'
import { PurchaseStatus, type Purchase } from '@/services/purchaseService'
import { resolveSupplierName } from '@/services/supplierService'
import { bytes32ToCid } from '@/lib/cid'
import { getIpfsGatewayUrl } from '@/services/ipfsService'
import { truncateAddress, formatDate } from '@/lib/format'
import { WalletRequired } from '@/components/WalletRequired'
import { PageHeader } from '@/components/PageHeader'
import { PageStateDisplay } from '@/components/PageStateDisplay'

const EMPTY_HASH = '0x' + '0'.repeat(64)

function impactProofUrl(hash: string): string | null {
  if (!hash || hash === EMPTY_HASH) return null
  try {
    return getIpfsGatewayUrl(bytes32ToCid(hash))
  } catch {
    return null
  }
}

function DeliveredOrderCard({
  order,
  supplierName,
  proofFile,
  onFileChange,
  onSubmitProof,
  onOpenDispute,
}: {
  order: Purchase
  supplierName: string
  proofFile: File | null
  onFileChange: (file: File | null) => void
  onSubmitProof: () => void
  onOpenDispute: () => void
}) {
  const confirmCountdown = useProposalCountdown(order.confirmDeadline)

  if (confirmCountdown.expired) {
    return (
      <Card
        key={String(order.purchaseId)}
        data-testid={`confirmed-card-${order.purchaseId}`}
        withBorder
      >
        <Stack gap="sm">
          <Group justify="space-between">
            <Text size="sm" fw={600}>
              {supplierName}
            </Text>
            <Text fw={600}>{formatEther(order.amount)} ETH</Text>
          </Group>
          {order.createdAt && (
            <Text size="xs" c="dimmed" data-testid={`order-date-${order.purchaseId}`}>
              {formatDate(order.createdAt)}
            </Text>
          )}
          <Group justify="flex-end">
            <Button
              data-testid={`btn-abrir-disputa-${order.purchaseId}`}
              color="red"
              size="sm"
              onClick={onOpenDispute}
            >
              Abrir Disputa
            </Button>
          </Group>
        </Stack>
      </Card>
    )
  }

  return (
    <Card
      key={String(order.purchaseId)}
      data-testid={`confirmed-card-${order.purchaseId}`}
      withBorder
    >
      <Stack gap="sm">
        <Group justify="space-between">
          <Text size="sm" fw={600}>
            {supplierName}
          </Text>
          <Text fw={600}>{formatEther(order.amount)} ETH</Text>
        </Group>
        {order.createdAt && (
          <Text size="xs" c="dimmed" data-testid={`order-date-${order.purchaseId}`}>
            {formatDate(order.createdAt)}
          </Text>
        )}
        <Text size="sm" data-testid={`confirm-countdown-${order.purchaseId}`} c="dimmed">
          Prazo para confirmação do recebimento: {confirmCountdown.display}
        </Text>
        <input
          data-testid={`input-proof-file-${order.purchaseId}`}
          type="file"
          accept="image/*,.pdf"
          onChange={(e) => onFileChange(e.target.files?.[0] ?? null)}
        />
        <Button
          data-testid={`btn-confirmar-${order.purchaseId}`}
          disabled={!proofFile}
          onClick={onSubmitProof}
        >
          Registrar Comprovante de Impacto
        </Button>
      </Stack>
    </Card>
  )
}

export default function MeusRecebimentosPage() {
  const { provider, signer, address } = useWallet()
  const { orders, loading, refetch } = usePurchaseOrders(provider, address)
  const { suppliers } = useSuppliers(provider)
  const { confirmReceiptAndSubmitProof, submitImpactProof, openDispute } =
    usePurchaseManager(signer)
  const { uploadAsBytes32 } = useIpfsUpload()

  const [proofSuccess, setProofSuccess] = useState(false)
  const [impactProofFileByOrderId, setProofFiles] = useState<Record<string, File | null>>({})

  if (!address) return <WalletRequired />

  const deliveredOrders = orders.filter((o) => o.status === PurchaseStatus.Delivered)
  const confirmedOrders = orders.filter((o) => o.status === PurchaseStatus.Confirmed)
  const history = orders.filter(
    (o) => o.status === PurchaseStatus.Paid || o.status === PurchaseStatus.Refunded,
  )

  const hasPending = deliveredOrders.length > 0 || confirmedOrders.length > 0

  async function handleSubmitProof(order: Purchase) {
    const file = impactProofFileByOrderId[String(order.purchaseId)]
    if (!file) return
    try {
      const hash = await uploadAsBytes32(file)
      if (order.status === PurchaseStatus.Delivered) {
        await confirmReceiptAndSubmitProof(order.purchaseId, hash)
      } else {
        await submitImpactProof(order.purchaseId, hash)
      }
      setProofSuccess(true)
    } finally {
      refetch()
    }
  }

  async function handleOpenDispute(order: Purchase) {
    try {
      await openDispute(order.purchaseId)
    } catch {
      // erro traduzido pelo hook
    } finally {
      refetch()
    }
  }

  function handleFileChange(purchaseId: bigint, file: File | null) {
    setProofFiles((prev) => ({ ...prev, [String(purchaseId)]: file }))
  }

  function getSupplierName(order: Purchase): string {
    return resolveSupplierName(suppliers, order.supplier) ?? truncateAddress(order.supplier)
  }

  return (
    <Stack p="md">
      <PageHeader title="Meus Recebimentos" onRefresh={refetch} loading={loading} />

      <PageStateDisplay
        loading={loading && !orders.length}
        empty={!loading && !hasPending && history.length === 0}
        emptyMessage="Nenhum pedido aguardando comprovante de impacto."
        emptyTestId="empty-recebimentos"
      />

      {proofSuccess && (
        <Alert data-testid="proof-success" color="green">
          Pagamento liberado. Comprovante de impacto registrado com sucesso.
        </Alert>
      )}

      {hasPending && (
        <Stack gap="sm" data-testid="section-aguardando-proof">
          <Title order={4}>Aguardando Prova de Impacto</Title>
          {deliveredOrders.map((order) => (
            <DeliveredOrderCard
              key={String(order.purchaseId)}
              order={order}
              supplierName={getSupplierName(order)}
              proofFile={impactProofFileByOrderId[String(order.purchaseId)] ?? null}
              onFileChange={(file) => handleFileChange(order.purchaseId, file)}
              onSubmitProof={() => handleSubmitProof(order)}
              onOpenDispute={() => handleOpenDispute(order)}
            />
          ))}
          {confirmedOrders.map((order) => (
            <Card
              key={String(order.purchaseId)}
              data-testid={`confirmed-card-${order.purchaseId}`}
              withBorder
            >
              <Stack gap="sm">
                <Group justify="space-between">
                  <Text size="sm" fw={600}>
                    {getSupplierName(order)}
                  </Text>
                  <Text fw={600}>{formatEther(order.amount)} ETH</Text>
                </Group>
                {order.createdAt && (
                  <Text size="xs" c="dimmed" data-testid={`order-date-${order.purchaseId}`}>
                    {formatDate(order.createdAt)}
                  </Text>
                )}
                <input
                  data-testid={`input-proof-file-${order.purchaseId}`}
                  type="file"
                  accept="image/*,.pdf"
                  onChange={(e) => handleFileChange(order.purchaseId, e.target.files?.[0] ?? null)}
                />
                <Button
                  data-testid={`btn-submit-proof-${order.purchaseId}`}
                  disabled={!impactProofFileByOrderId[String(order.purchaseId)]}
                  onClick={() => handleSubmitProof(order)}
                >
                  Registrar Comprovante de Impacto
                </Button>
              </Stack>
            </Card>
          ))}
        </Stack>
      )}

      {history.length > 0 && (
        <Stack gap="sm" data-testid="section-historico">
          <Title order={4}>Histórico</Title>
          {history.map((order) => (
            <Card
              key={String(order.purchaseId)}
              data-testid={`history-card-${order.purchaseId}`}
              withBorder
            >
              <Group justify="space-between">
                <Stack gap={4}>
                  <Text size="sm" fw={600}>
                    {getSupplierName(order)}
                  </Text>
                  <Text fw={600}>{formatEther(order.amount)} ETH</Text>
                  {order.createdAt && (
                    <Text size="xs" c="dimmed" data-testid={`order-date-${order.purchaseId}`}>
                      {formatDate(order.createdAt)}
                    </Text>
                  )}
                  {order.status === PurchaseStatus.Paid &&
                    impactProofUrl(order.impactProofHash) && (
                      <Anchor
                        href={impactProofUrl(order.impactProofHash)!}
                        target="_blank"
                        rel="noopener noreferrer"
                        size="sm"
                      >
                        Prova de Impacto ↗
                      </Anchor>
                    )}
                </Stack>
                <Badge color={order.status === PurchaseStatus.Paid ? 'green' : 'gray'}>
                  {order.status === PurchaseStatus.Paid ? 'Pago' : 'Devolvido'}
                </Badge>
              </Group>
            </Card>
          ))}
        </Stack>
      )}
    </Stack>
  )
}
