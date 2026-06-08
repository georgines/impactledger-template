'use client'

import { useState } from 'react'
import {
  Alert,
  Badge,
  Button,
  Card,
  Center,
  Group,
  Loader,
  Modal,
  SimpleGrid,
  Stack,
  Text,
  TextInput,
  Title,
} from '@mantine/core'
import { parseEther } from 'ethers'
import { useWallet } from '@/hooks/useWallet'
import { useDonation } from '@/hooks/useDonation'
import { useInstitutions } from '@/hooks/useInstitutions'
import { InstitutionStatus, type Institution } from '@/services/institutionService'
import { truncateAddress } from '@/lib/format'
import { WalletRequired } from '@/components/WalletRequired'
import { resolveAreaColor, getInitials } from '@/lib/display'

export default function FazerDoacaoPage() {
  const { provider, signer } = useWallet()
  const { institutions, loading: loadingInstitutions } = useInstitutions(provider)
  const { donate, loading: donating, error: donationError } = useDonation(signer)

  const [selected, setSelected] = useState<Institution | null>(null)
  const [amountEth, setAmountEth] = useState('')
  const [success, setSuccess] = useState(false)
  const [validationError, setValidationError] = useState<string | null>(null)

  if (!signer) return <WalletRequired message="Conecte sua carteira para realizar uma doação." />

  const visibleInstitutions = institutions.filter(
    (i) => i.status !== InstitutionStatus.Inactive && i.status !== InstitutionStatus.Removed,
  )

  const isPaused = selected?.status === InstitutionStatus.Paused
  const parsedAmount = parseFloat(amountEth)
  const canDonate = !isPaused && !!amountEth && parsedAmount > 0

  function openModal(institution: Institution) {
    setSelected(institution)
    setAmountEth('')
    setSuccess(false)
    setValidationError(null)
  }

  function closeModal() {
    setSelected(null)
    setAmountEth('')
    setSuccess(false)
    setValidationError(null)
  }

  async function handleDonate(e: React.FormEvent) {
    e.preventDefault()
    setValidationError(null)

    if (!amountEth || parsedAmount <= 0) {
      setValidationError('Informe um valor maior que zero.')
      return
    }

    try {
      await donate(selected!.address, parseEther(amountEth))
      setSuccess(true)
      setAmountEth('')
    } catch {
      // erro exibido via donationError do hook
    }
  }

  return (
    <Stack p="md" gap="xl">
      <Title order={2}>Fazer Doação</Title>

      {loadingInstitutions && (
        <Center py="xl">
          <Loader />
        </Center>
      )}

      {!loadingInstitutions && visibleInstitutions.length === 0 && (
        <Alert color="gray" data-testid="empty-institutions">
          <Text>Nenhuma instituição disponível no momento.</Text>
        </Alert>
      )}

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
              >
                <Center
                  bg={color}
                  h={120}
                  style={{
                    borderRadius: 'var(--mantine-radius-md) var(--mantine-radius-md) 0 0',
                  }}
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
                    <Badge color={paused ? 'orange' : 'green'} variant="light" size="sm">
                      {paused ? 'Pausada' : 'Ativa'}
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
        title={`Doe para ${selected?.name ?? ''}`}
        centered
      >
        {selected && (
          <Stack>
            <Group gap="xs">
              <Badge color={resolveAreaColor(selected.areaOfWork)} variant="dot">
                {selected.areaOfWork}
              </Badge>
              {isPaused && (
                <Badge color="orange" variant="light">
                  Pausada
                </Badge>
              )}
            </Group>

            <Text size="xs" c="dimmed" ff="monospace" title={selected.address}>
              {truncateAddress(selected.address)}
            </Text>

            {isPaused && (
              <Alert color="orange" data-testid="paused-alert">
                <Text size="sm">Esta instituição está pausada e não pode receber doações.</Text>
              </Alert>
            )}

            <form onSubmit={handleDonate}>
              <Stack>
                <TextInput
                  label="Valor (ETH)"
                  placeholder="0.01"
                  type="number"
                  min="0"
                  step="any"
                  value={amountEth}
                  disabled={isPaused}
                  onChange={(e) => {
                    setAmountEth(e.currentTarget.value)
                    setSuccess(false)
                  }}
                />

                {validationError && <Alert color="red">{validationError}</Alert>}
                {donationError && <Alert color="red">{donationError}</Alert>}
                {success && (
                  <Alert color="green" data-testid="donation-success">
                    Doação realizada com sucesso!
                  </Alert>
                )}

                <Button
                  type="submit"
                  disabled={!canDonate}
                  loading={donating}
                  fullWidth
                  data-testid="btn-confirmar-doacao"
                >
                  Confirmar Doação
                </Button>
              </Stack>
            </form>
          </Stack>
        )}
      </Modal>
    </Stack>
  )
}
