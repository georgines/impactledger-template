'use client'

import { useEffect, useState } from 'react'
import { formatEther } from 'ethers'
import {
  Alert,
  Anchor,
  Card,
  Center,
  Grid,
  Loader,
  Stack,
  Table,
  Text,
  TextInput,
  Title,
} from '@mantine/core'
import { IconSearch } from '@tabler/icons-react'
import type { Provider } from 'ethers'
import { useWallet } from '@/hooks/useWallet'
import { useTreasury, type InstitutionBalance, type PaymentEvent } from '@/hooks/useTreasury'
import { useInstitutions } from '@/hooks/useInstitutions'
import { usePlatformStats } from '@/hooks/usePlatformStats'
import { InstitutionStatus, resolveInstitutionName } from '@/services/institutionService'
import { truncateAddress, formatDate } from '@/lib/format'

function formatBalanceInETH(value: bigint | null): string {
  return value !== null ? `${formatEther(value)} ETH` : '—'
}

function InstituicaoView({
  address,
  getAvailableBalance,
  getReservedBalance,
}: {
  address: string
  getAvailableBalance: (addr: string) => Promise<bigint>
  getReservedBalance: (addr: string) => Promise<bigint>
}) {
  const [available, setAvailable] = useState<bigint | null>(null)
  const [reserved, setReserved] = useState<bigint | null>(null)

  useEffect(() => {
    getAvailableBalance(address)
      .then(setAvailable)
      .catch(() => setAvailable(null))
    getReservedBalance(address)
      .then(setReserved)
      .catch(() => setReserved(null))
  }, [address])

  return (
    <Stack gap="lg">
      <Title order={2}>Saldo</Title>
      <Grid>
        <Grid.Col span={{ base: 12, sm: 6 }}>
          <Card withBorder p="xl" radius="md" data-testid="saldo-disponivel">
            <Text size="sm" c="dimmed" mb={4}>
              Saldo Disponível
            </Text>
            <Text size="xl" fw={700} c="green">
              {formatBalanceInETH(available)}
            </Text>
            <Text size="xs" c="dimmed" mt={4}>
              Disponível para novos pedidos
            </Text>
          </Card>
        </Grid.Col>
        <Grid.Col span={{ base: 12, sm: 6 }}>
          <Card withBorder p="xl" radius="md" data-testid="saldo-bloqueado">
            <Text size="sm" c="dimmed" mb={4}>
              Saldo Bloqueado
            </Text>
            <Text size="xl" fw={700} c="orange">
              {formatBalanceInETH(reserved)}
            </Text>
            <Text size="xs" c="dimmed" mt={4}>
              Reservado em pedidos em aberto
            </Text>
          </Card>
        </Grid.Col>
      </Grid>
    </Stack>
  )
}

function FornecedorView({
  address,
  provider,
  getPaymentHistory,
}: {
  address: string
  provider: Provider | null
  getPaymentHistory: (addr: string) => Promise<PaymentEvent[]>
}) {
  const [history, setHistory] = useState<PaymentEvent[] | null>(null)
  const [loading, setLoading] = useState(false)
  const { institutions } = useInstitutions(provider)

  useEffect(() => {
    setLoading(true)
    getPaymentHistory(address)
      .then(setHistory)
      .catch(() => setHistory([]))
      .finally(() => setLoading(false))
  }, [address])

  return (
    <Stack gap="lg">
      <Title order={2}>Histórico de Recebimentos</Title>
      <div data-testid="historico-recebimentos">
        {loading && (
          <Center py="xl">
            <Loader />
          </Center>
        )}
        {!loading && history !== null && history.length === 0 && (
          <Alert color="gray" data-testid="historico-vazio">
            Nenhum recebimento registrado.
          </Alert>
        )}
        {!loading && history !== null && history.length > 0 && (
          <Table striped highlightOnHover>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Pedido</Table.Th>
                <Table.Th>Instituição</Table.Th>
                <Table.Th>Valor</Table.Th>
                <Table.Th>Data</Table.Th>
                <Table.Th>Transação</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {history.map((payment) => {
                const institutionName = payment.institutionAddress
                  ? (resolveInstitutionName(institutions, payment.institutionAddress) ??
                    truncateAddress(payment.institutionAddress))
                  : '—'
                return (
                  <Table.Tr
                    key={payment.transactionHash}
                    data-testid={`payment-row-${payment.purchaseId}`}
                  >
                    <Table.Td>#{payment.purchaseId.toString()}</Table.Td>
                    <Table.Td>{institutionName}</Table.Td>
                    <Table.Td>{formatEther(payment.amount)} ETH</Table.Td>
                    <Table.Td>{formatDate(payment.timestamp)}</Table.Td>
                    <Table.Td ff="monospace">{truncateAddress(payment.transactionHash)}</Table.Td>
                  </Table.Tr>
                )
              })}
            </Table.Tbody>
          </Table>
        )}
      </div>
    </Stack>
  )
}

function InstitutionPausedAlert({
  address,
  provider,
}: {
  address: string
  provider: Provider | null
}) {
  const { institutions } = useInstitutions(provider)
  const inst = institutions.find((i) => i.address.toLowerCase() === address.toLowerCase())
  if (!inst || inst.status !== InstitutionStatus.Paused) return null
  return (
    <Alert color="orange" data-testid="institution-paused-alert">
      Sua conta está pausada. Novos pedidos não são permitidos enquanto a pausa estiver ativa.
    </Alert>
  )
}

function computeTotalInSystem(
  centralVault: bigint | null,
  balances: InstitutionBalance[],
): bigint | null {
  if (centralVault === null) return null
  const institutionTotal = balances.reduce((sum, b) => sum + b.available + b.reserved, BigInt(0))
  return centralVault + institutionTotal
}

function OperadorView({
  provider,
  getCentralVault,
  getInstitutionBalances,
}: {
  provider: unknown
  getCentralVault: () => Promise<bigint>
  getInstitutionBalances: (addresses: string[]) => Promise<InstitutionBalance[]>
}) {
  const { institutions, loading: loadingInst } = useInstitutions(
    provider as Parameters<typeof useInstitutions>[0],
  )
  const { totalHistoricalDonations } = usePlatformStats(
    provider as Parameters<typeof usePlatformStats>[0],
  )
  const [centralVault, setCentralVault] = useState<bigint | null>(null)
  const [balances, setBalances] = useState<InstitutionBalance[]>([])
  const [search, setSearch] = useState('')

  useEffect(() => {
    getCentralVault()
      .then(setCentralVault)
      .catch(() => setCentralVault(null))
  }, [])

  useEffect(() => {
    if (institutions.length === 0) return
    getInstitutionBalances(institutions.map((i) => i.address))
      .then(setBalances)
      .catch(() => {})
  }, [institutions])

  const filtered = institutions.filter((inst) =>
    inst.name.toLowerCase().includes(search.toLowerCase()),
  )

  const balanceMap = new Map(balances.map((b) => [b.address, b]))
  const totalInSystem = computeTotalInSystem(centralVault, balances)

  return (
    <Stack gap="lg">
      <Title order={2}>Saldo da Plataforma</Title>

      <Grid>
        <Grid.Col span={{ base: 12, sm: 4 }}>
          <Card withBorder p="xl" radius="md" data-testid="total-historico">
            <Text size="sm" c="dimmed" mb={4}>
              Total Histórico de Doações
            </Text>
            <Text size="xl" fw={700} c="teal">
              {formatBalanceInETH(totalHistoricalDonations)}
            </Text>
            <Text size="xs" c="dimmed" mt={4}>
              Soma de todas as doações desde o deploy
            </Text>
          </Card>
        </Grid.Col>
        <Grid.Col span={{ base: 12, sm: 4 }}>
          <Card withBorder p="xl" radius="md" data-testid="total-em-caixa">
            <Text size="sm" c="dimmed" mb={4}>
              Total Atualmente em Caixa
            </Text>
            <Text size="xl" fw={700} c="green">
              {formatBalanceInETH(totalInSystem)}
            </Text>
            <Text size="xs" c="dimmed" mt={4}>
              Saldo vivo: instituições + cofre central
            </Text>
          </Card>
        </Grid.Col>
        <Grid.Col span={{ base: 12, sm: 4 }}>
          <Card withBorder p="xl" radius="md" data-testid="cofre-central">
            <Text size="sm" c="dimmed" mb={4}>
              Cofre Central
            </Text>
            <Text size="xl" fw={700} c="blue">
              {formatBalanceInETH(centralVault)}
            </Text>
            <Text size="xs" c="dimmed" mt={4}>
              Acumula saldo de instituições removidas
            </Text>
          </Card>
        </Grid.Col>
      </Grid>

      <Stack gap="sm">
        <Title order={4}>Instituições</Title>
        <TextInput
          data-testid="search-input"
          placeholder="Buscar por nome"
          leftSection={<IconSearch size={16} />}
          value={search}
          onChange={(e) => setSearch(e.currentTarget.value)}
        />

        {loadingInst && (
          <Center py="xl">
            <Loader />
          </Center>
        )}

        {!loadingInst && (
          <Table striped highlightOnHover>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Instituição</Table.Th>
                <Table.Th>Área</Table.Th>
                <Table.Th>Disponível</Table.Th>
                <Table.Th>Bloqueado</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {filtered.map((inst) => {
                const bal = balanceMap.get(inst.address)
                return (
                  <Table.Tr key={inst.address} data-testid={`institution-row-${inst.address}`}>
                    <Table.Td>
                      <Stack gap={2}>
                        <Text size="sm" fw={500}>
                          {inst.name}
                        </Text>
                        <Text size="xs" c="dimmed" ff="monospace">
                          {truncateAddress(inst.address)}
                        </Text>
                      </Stack>
                    </Table.Td>
                    <Table.Td>{inst.areaOfWork}</Table.Td>
                    <Table.Td c="green">{bal ? `${formatEther(bal.available)} ETH` : '—'}</Table.Td>
                    <Table.Td c="orange">{bal ? `${formatEther(bal.reserved)} ETH` : '—'}</Table.Td>
                  </Table.Tr>
                )
              })}
            </Table.Tbody>
          </Table>
        )}
      </Stack>
    </Stack>
  )
}

export default function SaldoPage() {
  const { provider, address, role } = useWallet()
  const {
    getAvailableBalance,
    getReservedBalance,
    getCentralVault,
    getPaymentHistory,
    getInstitutionBalances,
  } = useTreasury(provider)

  if (!address) {
    return (
      <Stack p="md">
        <Alert color="yellow">Conecte sua carteira para continuar.</Alert>
      </Stack>
    )
  }

  if (role === 'instituicao') {
    return (
      <Stack p="md">
        <InstitutionPausedAlert address={address} provider={provider} />
        <InstituicaoView
          address={address}
          getAvailableBalance={getAvailableBalance}
          getReservedBalance={getReservedBalance}
        />
      </Stack>
    )
  }

  if (role === 'fornecedor') {
    return (
      <Stack p="md">
        <FornecedorView
          address={address}
          provider={provider}
          getPaymentHistory={getPaymentHistory}
        />
      </Stack>
    )
  }

  if (role === 'operador') {
    return (
      <Stack p="md">
        <OperadorView
          provider={provider}
          getCentralVault={getCentralVault}
          getInstitutionBalances={getInstitutionBalances}
        />
      </Stack>
    )
  }

  return (
    <Stack p="md">
      <Alert color="red">Acesso não autorizado.</Alert>
    </Stack>
  )
}
