'use client'

import { useEffect, useState } from 'react'
import { formatEther, parseEther } from 'ethers'
import {
  Alert,
  Badge,
  Button,
  Card,
  Center,
  Loader,
  Modal,
  SimpleGrid,
  Stack,
  Text,
  Textarea,
  TextInput,
  Title,
} from '@mantine/core'
import { useRouter } from 'next/navigation'
import { useWallet } from '@/hooks/useWallet'
import { useWalletContext } from '@/components/providers/WalletProvider'
import { useSuppliers } from '@/hooks/useSuppliers'
import { usePurchaseManager } from '@/hooks/usePurchaseManager'
import { useTreasury } from '@/hooks/useTreasury'
import { useIpfsUpload } from '@/hooks/useIpfsUpload'
import { useInstitutions } from '@/hooks/useInstitutions'
import { translateContractError } from '@/services/contractErrors'
import { InstitutionStatus } from '@/services/institutionService'
import { IconSearch } from '@tabler/icons-react'
import { resolveAreaColor, getInitials } from '@/lib/display'
import { truncateAddress } from '@/lib/format'
import { WalletRequired } from '@/components/WalletRequired'
import type { Supplier } from '@/services/supplierService'

export default function NovoPedidoPage() {
  const router = useRouter()
  const { provider, signer, address } = useWallet()
  const { role } = useWalletContext()
  const { suppliers, loading } = useSuppliers(provider)
  const { createOrder, loading: creating, error } = usePurchaseManager(signer)
  const { getAvailableBalance } = useTreasury(provider)
  const { uploadAsBytes32 } = useIpfsUpload()
  const { institutions } = useInstitutions(provider)

  const [search, setSearch] = useState('')
  const [selectedSupplier, setSelectedSupplier] = useState<Supplier | null>(null)
  const [availableBalance, setAvailableBalance] = useState<bigint | null>(null)
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [amount, setAmount] = useState('')
  const [deadline, setDeadline] = useState('')
  const [success, setSuccess] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)

  useEffect(() => {
    if (role !== null && role !== 'instituicao') {
      router.push('/')
    }
  }, [role])

  useEffect(() => {
    if (!address) return
    getAvailableBalance(address)
      .then(setAvailableBalance)
      .catch(() => setAvailableBalance(null))
  }, [address])

  if (!address) return <WalletRequired />

  const currentInstitution = institutions.find(
    (i) => i.address.toLowerCase() === address.toLowerCase(),
  )
  if (currentInstitution?.status === InstitutionStatus.Paused) {
    return (
      <Stack p="md">
        <Alert color="orange" data-testid="institution-paused-novo-pedido">
          Sua conta está pausada. Novos pedidos não são permitidos enquanto a pausa estiver ativa.
        </Alert>
      </Stack>
    )
  }

  const activeSuppliers = suppliers.filter((s) => s.approved)
  const filtered = activeSuppliers.filter((s) => {
    const q = search.toLowerCase()
    return s.name.toLowerCase().includes(q) || s.serviceType.toLowerCase().includes(q)
  })

  let amountWei = BigInt(0)
  try {
    amountWei = amount ? parseEther(amount) : BigInt(0)
  } catch {
    amountWei = BigInt(0)
  }

  const deadlineSeconds = parseFloat(deadline)
  const isAmountValid =
    amountWei > BigInt(0) && (availableBalance === null || amountWei <= availableBalance)
  const isFormValid =
    title.trim() !== '' && description.trim() !== '' && isAmountValid && deadlineSeconds > 0

  function handleCardClick(supplier: Supplier) {
    setSelectedSupplier(supplier)
    setTitle('')
    setDescription('')
    setAmount('')
    setDeadline('')
    setSuccess(false)
    setSubmitError(null)
  }

  function handleModalClose() {
    setSelectedSupplier(null)
    setSuccess(false)
    setSubmitError(null)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!selectedSupplier) return
    setSubmitError(null)
    setSuccess(false)
    const deadlineTimestamp = BigInt(Math.floor(Date.now() / 1000 + deadlineSeconds))
    try {
      const metadata = JSON.stringify({
        title,
        description,
        createdAt: new Date().toISOString().split('T')[0],
      })
      const descriptionHash = await uploadAsBytes32(metadata)
      await createOrder(selectedSupplier.address, amountWei, deadlineTimestamp, descriptionHash)
      setSuccess(true)
      setTitle('')
      setDescription('')
      setAmount('')
      setDeadline('')
    } catch (err) {
      setSubmitError(translateContractError(err))
    }
  }

  return (
    <Stack p="md" gap="xl">
      <Title order={2}>Novo Pedido</Title>

      <Card withBorder p="md" radius="md">
        <TextInput
          data-testid="search-input"
          label="Buscar fornecedor"
          placeholder="Nome ou tipo de serviço"
          leftSection={<IconSearch size={16} />}
          value={search}
          onChange={(e) => setSearch(e.currentTarget.value)}
        />
      </Card>

      {loading && (
        <Center py="xl">
          <Loader />
        </Center>
      )}

      {!loading && filtered.length === 0 && (
        <Alert color="gray" data-testid="empty-suppliers">
          <Text>Nenhum fornecedor aprovado disponível.</Text>
        </Alert>
      )}

      <Center>
        <SimpleGrid cols={{ base: 1, sm: 2, md: 3, lg: 4 }} spacing="lg" w="100%" maw={1200}>
          {filtered.map((supplier) => {
            const color = resolveAreaColor(supplier.serviceType)
            return (
              <Card
                key={supplier.address}
                shadow="sm"
                radius="md"
                withBorder
                padding={0}
                onClick={() => handleCardClick(supplier)}
                style={{ cursor: 'pointer' }}
                data-testid={`supplier-card-${supplier.address}`}
              >
                <Center
                  bg={color}
                  h={120}
                  style={{
                    borderRadius: 'var(--mantine-radius-md) var(--mantine-radius-md) 0 0',
                  }}
                >
                  <Text size="3rem" fw={700} c="white">
                    {getInitials(supplier.name)}
                  </Text>
                </Center>

                <Stack p="md" gap="xs">
                  <Text fw={600} size="md">
                    {supplier.name}
                  </Text>
                  <Badge color={color} variant="dot" size="sm">
                    {supplier.serviceType}
                  </Badge>
                  <Text size="xs" c="dimmed" ff="monospace">
                    {truncateAddress(supplier.address)}
                  </Text>
                </Stack>
              </Card>
            )
          })}
        </SimpleGrid>
      </Center>

      <Modal
        opened={!!selectedSupplier}
        onClose={handleModalClose}
        title={selectedSupplier?.name ?? ''}
        centered
      >
        <div data-testid="modal-novo-pedido">
          <Stack gap="md">
            {availableBalance !== null && (
              <Alert data-testid="balance-alert" color="blue">
                Saldo disponível: {formatEther(availableBalance)} ETH
              </Alert>
            )}

            {success && (
              <Alert data-testid="order-success" color="green">
                Pedido criado com sucesso. <a href="/pedidos-de-compra">Ver pedidos</a>
              </Alert>
            )}

            {(submitError ?? error) && (
              <Alert data-testid="order-error" color="red">
                {submitError ?? error}
              </Alert>
            )}

            <form onSubmit={handleSubmit}>
              <Stack gap="sm">
                <TextInput
                  data-testid="input-title"
                  label="Título"
                  placeholder="Nome do produto ou serviço"
                  value={title}
                  onChange={(e) => setTitle(e.currentTarget.value)}
                />

                <Textarea
                  data-testid="input-description"
                  label="Descrição"
                  placeholder="Descrição do produto ou serviço"
                  value={description}
                  onChange={(e) => setDescription(e.currentTarget.value)}
                  rows={3}
                />

                <TextInput
                  data-testid="input-amount"
                  label="Valor (ETH)"
                  placeholder="0.01"
                  type="number"
                  step="0.0001"
                  min="0"
                  value={amount}
                  onChange={(e) => setAmount(e.currentTarget.value)}
                />

                {amount &&
                  amountWei > BigInt(0) &&
                  availableBalance !== null &&
                  amountWei > availableBalance && (
                    <Text size="sm" c="red" data-testid="balance-warning">
                      O valor informado é maior que o seu saldo disponível.
                    </Text>
                  )}

                <TextInput
                  data-testid="input-deadline"
                  label="Prazo (segundos)"
                  placeholder="90"
                  type="number"
                  min="1"
                  step="1"
                  value={deadline}
                  onChange={(e) => setDeadline(e.currentTarget.value)}
                />

                <Button
                  type="submit"
                  data-testid="btn-criar-pedido"
                  disabled={!isFormValid || creating}
                  loading={creating}
                  fullWidth
                >
                  Criar Pedido
                </Button>
              </Stack>
            </form>
          </Stack>
        </div>
      </Modal>
    </Stack>
  )
}
