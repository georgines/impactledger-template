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
  Stack,
  Text,
  Title,
} from '@mantine/core'
import { IconRefresh } from '@tabler/icons-react'
import { useWallet } from '@/hooks/useWallet'
import { useDisputeOrders } from '@/hooks/useDisputeOrders'
import { usePurchaseManager } from '@/hooks/usePurchaseManager'
import { useIpfsUpload } from '@/hooks/useIpfsUpload'
import { useProposalCountdown } from '@/hooks/useProposalCountdown'
import { useSuppliers } from '@/hooks/useSuppliers'
import { useInstitutions } from '@/hooks/useInstitutions'
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

interface MyDisputeCardProps {
  order: Purchase
  provider: Provider | null
  suppliers: Supplier[]
  institutions: Institution[]
  onSubmitEvidence: (purchaseId: bigint, file: File) => Promise<void>
}

function MyDisputeCard({
  order,
  provider,
  suppliers,
  institutions,
  onSubmitEvidence,
}: MyDisputeCardProps) {
  const { display, expired } = useProposalCountdown(order.disputeDeadline)
  const [file, setFile] = useState<File | null>(null)

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

        <Divider />

        <DisputeTimeline
          provider={provider}
          purchaseId={order.purchaseId}
          institution={order.institution}
          supplier={order.supplier}
          institutionName={institutionName}
          supplierName={supplierName}
        />

        <Divider />

        <input
          data-testid={`input-evidence-file-${order.purchaseId}`}
          type="file"
          accept="image/*,.pdf"
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
        />
        <Button
          data-testid={`btn-enviar-evidencia-${order.purchaseId}`}
          disabled={!file || expired}
          onClick={() => file && onSubmitEvidence(order.purchaseId, file)}
        >
          Enviar Evidência
        </Button>
      </Stack>
    </Card>
  )
}

export default function MinhasDisputasPage() {
  const { provider, signer, address } = useWallet()
  const { orders, loading, refetch } = useDisputeOrders(provider)
  const { addDisputeEvidence, error: txError } = usePurchaseManager(signer)
  const { uploadAsBytes32 } = useIpfsUpload()
  const { suppliers } = useSuppliers(provider)
  const { institutions } = useInstitutions(provider)

  const [evidenceSuccess, setEvidenceSuccess] = useState(false)

  if (!address) return <WalletRequired />

  const myDisputes = orders.filter(
    (o) =>
      o.institution.toLowerCase() === address.toLowerCase() ||
      o.supplier.toLowerCase() === address.toLowerCase(),
  )

  async function handleSendEvidence(purchaseId: bigint, file: File) {
    try {
      const hash = await uploadAsBytes32(file)
      await addDisputeEvidence(purchaseId, hash)
      setEvidenceSuccess(true)
    } finally {
      refetch()
    }
  }

  return (
    <Stack p="md">
      <PageHeader title="Minhas Disputas" onRefresh={refetch} loading={loading} />

      <PageStateDisplay
        loading={loading && !orders.length}
        empty={!loading && myDisputes.length === 0}
        emptyMessage="Nenhuma disputa ativa."
        emptyTestId="empty-minhas-disputas"
      />

      {txError && (
        <Alert color="red">
          <Text>{txError}</Text>
        </Alert>
      )}

      {evidenceSuccess && (
        <Alert data-testid="evidence-success" color="green">
          Evidência registrada com sucesso.
        </Alert>
      )}

      {myDisputes.map((order) => (
        <MyDisputeCard
          key={String(order.purchaseId)}
          order={order}
          provider={provider}
          suppliers={suppliers}
          institutions={institutions}
          onSubmitEvidence={handleSendEvidence}
        />
      ))}
    </Stack>
  )
}
