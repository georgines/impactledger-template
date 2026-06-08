'use client'

import {
  Alert,
  Badge,
  Button,
  Card,
  Center,
  Divider,
  Group,
  Loader,
  Modal,
  SimpleGrid,
  Stack,
  Text,
  TextInput,
  Title,
} from '@mantine/core'
import { useState } from 'react'
import { useWallet } from '@/hooks/useWallet'
import { useInstitutions } from '@/hooks/useInstitutions'
import { useGovernance } from '@/hooks/useGovernance'
import { InstitutionStatus, type Institution } from '@/services/institutionService'
import { translateContractError } from '@/services/contractErrors'
import { truncateAddress } from '@/lib/format'
import { resolveAreaColor, getInitials } from '@/lib/display'
import { PageStateDisplay } from '@/components/PageStateDisplay'
import { WalletRequired } from '@/components/WalletRequired'

const STATUS_LABEL: Record<InstitutionStatus, string> = {
  [InstitutionStatus.Inactive]: 'Inativa',
  [InstitutionStatus.Active]: 'Ativa',
  [InstitutionStatus.Paused]: 'Pausada',
  [InstitutionStatus.Removed]: 'Removida',
}

const STATUS_COLOR: Record<InstitutionStatus, string> = {
  [InstitutionStatus.Inactive]: 'gray',
  [InstitutionStatus.Active]: 'green',
  [InstitutionStatus.Paused]: 'gray',
  [InstitutionStatus.Removed]: 'red',
}

function isVisible(status: InstitutionStatus): boolean {
  return status !== InstitutionStatus.Inactive && status !== InstitutionStatus.Removed
}

export default function InstituicoesPage() {
  const { provider, signer, role } = useWallet()
  const { institutions, loading, error } = useInstitutions(provider)
  const { propose, loading: proposing } = useGovernance(signer)

  const [selected, setSelected] = useState<Institution | null>(null)
  const [motivo, setMotivo] = useState('')
  const [success, setSuccess] = useState(false)
  const [proposeError, setProposeError] = useState<string | null>(null)

  if (!provider)
    return <WalletRequired message="Conecte sua carteira para visualizar as instituições." />

  const visibleInstitutions = institutions.filter((i) => isVisible(i.status))
  const isOperator = role === 'operador'
  const canPropose = motivo.trim().length > 0

  function openModal(institution: Institution) {
    setSelected(institution)
    setMotivo('')
    setSuccess(false)
    setProposeError(null)
  }

  function closeModal() {
    setSelected(null)
    setMotivo('')
    setSuccess(false)
    setProposeError(null)
  }

  async function handlePropose(kind: number) {
    if (!selected || !canPropose) return
    setProposeError(null)
    try {
      await propose({
        kind,
        target: selected.address,
        name: selected.name,
        metadata: motivo,
        purchaseId: BigInt(0),
        disputeVerdict: false,
      })
      setSuccess(true)
      setMotivo('')
    } catch (err) {
      setProposeError(translateContractError(err))
    }
  }

  return (
    <Stack p="md" gap="xl">
      <Title order={2}>Instituições</Title>

      <PageStateDisplay
        loading={loading}
        error={!loading ? (error ?? null) : null}
        empty={!loading && !error && visibleInstitutions.length === 0}
        emptyMessage="Nenhuma instituição cadastrada na plataforma."
        emptyTestId="empty-institutions"
      />

      <Center>
        <SimpleGrid cols={{ base: 1, sm: 2, md: 3, lg: 4 }} spacing="lg" w="100%" maw={1200}>
          {visibleInstitutions.map((institution) => {
            const color = resolveAreaColor(institution.areaOfWork)
            const paused = institution.status === InstitutionStatus.Paused

            return (
              <Card
                key={institution.address}
                shadow="sm"
                radius="md"
                withBorder
                padding={0}
                onClick={() => openModal(institution)}
                style={{ cursor: 'pointer', opacity: paused ? 0.65 : 1 }}
                data-testid={`institution-card-${institution.address}`}
                data-paused={paused ? 'true' : undefined}
              >
                <Center
                  bg={paused ? 'gray' : color}
                  h={120}
                  style={{ borderRadius: 'var(--mantine-radius-md) var(--mantine-radius-md) 0 0' }}
                >
                  <Text size="3rem" fw={700} c="white">
                    {getInitials(institution.name)}
                  </Text>
                </Center>

                <Stack p="md" gap="xs">
                  <Group justify="space-between" align="flex-start">
                    <Text fw={600} size="md" style={{ flex: 1 }}>
                      {institution.name}
                    </Text>
                    <Badge color={STATUS_COLOR[institution.status]} variant="light" size="sm">
                      {STATUS_LABEL[institution.status]}
                    </Badge>
                  </Group>

                  <Badge color={color} variant="dot" size="sm">
                    {institution.areaOfWork}
                  </Badge>

                  <Text size="xs" c="dimmed" ff="monospace" title={institution.address}>
                    {truncateAddress(institution.address)}
                  </Text>
                </Stack>
              </Card>
            )
          })}
        </SimpleGrid>
      </Center>

      <Modal
        opened={!!selected}
        onClose={closeModal}
        title={selected?.name ?? ''}
        centered
        data-testid="institution-modal"
      >
        {selected && (
          <Stack gap="sm" data-testid="institution-modal">
            <Group gap="xs">
              <Badge color={resolveAreaColor(selected.areaOfWork)} variant="dot">
                {selected.areaOfWork}
              </Badge>
              <Badge color={STATUS_COLOR[selected.status]} variant="light">
                {STATUS_LABEL[selected.status]}
              </Badge>
            </Group>

            <Text size="sm" c="dimmed">
              Identificador digital
            </Text>
            <Text size="sm" ff="monospace">
              {selected.address}
            </Text>

            {isOperator && (
              <>
                <Divider mt="xs" />
                <Stack gap="sm" data-testid="governance-actions">
                  <Text size="sm" fw={600}>
                    O que deseja fazer com esta instituição?
                  </Text>

                  <TextInput
                    label="Motivo da Proposta"
                    placeholder="Descreva o motivo desta proposta"
                    value={motivo}
                    onChange={(e) => {
                      setMotivo(e.currentTarget.value)
                      setSuccess(false)
                    }}
                    data-testid="input-motivo"
                  />

                  {proposeError && <Alert color="red">{proposeError}</Alert>}

                  {success && (
                    <Alert color="green" data-testid="propose-success">
                      Proposta enviada para votação com sucesso!
                    </Alert>
                  )}

                  <Group grow>
                    {selected.status !== InstitutionStatus.Paused && (
                      <Button
                        color="orange"
                        variant="light"
                        disabled={!canPropose}
                        loading={proposing}
                        onClick={() => handlePropose(2)}
                        data-testid="btn-pausar"
                      >
                        Pausar
                      </Button>
                    )}
                    {selected.status === InstitutionStatus.Paused && (
                      <Button
                        color="blue"
                        variant="light"
                        disabled={!canPropose}
                        loading={proposing}
                        onClick={() => handlePropose(3)}
                        data-testid="btn-despausar"
                      >
                        Despausar
                      </Button>
                    )}
                    <Button
                      color="red"
                      variant="light"
                      disabled={!canPropose}
                      loading={proposing}
                      onClick={() => handlePropose(4)}
                      data-testid="btn-remover"
                    >
                      Remover
                    </Button>
                  </Group>
                </Stack>
              </>
            )}
          </Stack>
        )}
      </Modal>
    </Stack>
  )
}
