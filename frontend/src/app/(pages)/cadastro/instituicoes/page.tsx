'use client'

import { useState } from 'react'
import { Alert, Button, Card, Center, Stack, Text, TextInput, Title } from '@mantine/core'
import { useWallet } from '@/hooks/useWallet'
import { useGovernance, type ProposalInput } from '@/hooks/useGovernance'
import { useBootstrapRegister } from '@/hooks/useBootstrapRegister'
import { useBootstrapStatus } from '@/hooks/useBootstrapStatus'
import {
  validateBootstrapForm,
  type BootstrapFormState,
  type BootstrapFormErrors,
} from '@/services/governanceService'

const EMPTY_FORM: BootstrapFormState = { address: '', name: '', areaOfWork: '' }

export default function CadastroInstituicaoPage() {
  const { signer, role, provider } = useWallet()
  const { propose, loading: proposing, error: proposalError } = useGovernance(signer)
  const {
    bootstrapRegister,
    loading: bootstrapping,
    error: bootstrapError,
  } = useBootstrapRegister(signer)
  const { isBootstrapped, loading: checkingBootstrap } = useBootstrapStatus(provider)

  const [form, setForm] = useState<BootstrapFormState>(EMPTY_FORM)
  const [errors, setErrors] = useState<BootstrapFormErrors>({})
  const [bootstrapDone, setBootstrapDone] = useState(false)
  const [success, setSuccess] = useState(false)

  const effectivelyBootstrapped = isBootstrapped || bootstrapDone

  if (!signer) {
    return (
      <Stack p="md">
        <Alert color="yellow">
          <Text>Conecte sua carteira para continuar.</Text>
        </Alert>
      </Stack>
    )
  }

  function updateField(field: keyof BootstrapFormState, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }))
    setErrors((prev) => ({ ...prev, [field]: undefined }))
    setSuccess(false)
  }

  async function submitBootstrap() {
    try {
      await bootstrapRegister(form.address, form.name, form.areaOfWork)
      setBootstrapDone(true)
      setForm(EMPTY_FORM)
    } catch {
      // error shown via bootstrapError
    }
  }

  async function submitProposal() {
    const input: ProposalInput = {
      kind: 0,
      target: form.address,
      name: form.name,
      metadata: form.areaOfWork,
      purchaseId: BigInt(0),
      disputeVerdict: false,
    }
    await propose(input)
    setSuccess(true)
    setForm(EMPTY_FORM)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const validationErrors = validateBootstrapForm(form)
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors)
      return
    }
    if (effectivelyBootstrapped) {
      await submitProposal()
    } else {
      await submitBootstrap()
    }
  }

  const loading = effectivelyBootstrapped ? proposing : bootstrapping
  const error = effectivelyBootstrapped ? proposalError : bootstrapError

  return (
    <Center h="100%">
      <Stack w="100%" maw={560} gap="xl">
        <Card shadow="sm" padding="xl" radius="md" withBorder>
          <Stack>
            <Title order={2}>Cadastrar Instituição</Title>

            {!checkingBootstrap && !effectivelyBootstrapped && (
              <Alert color="blue" data-testid="bootstrap-section">
                Registro Inicial da Plataforma: use esta função apenas uma vez, antes de qualquer
                votação, para registrar a primeira instituição sem necessidade de votos. Após o uso,
                esta função é bloqueada permanentemente.
              </Alert>
            )}

            {error && <Alert color="red">{error}</Alert>}

            {bootstrapDone && !isBootstrapped && !success && (
              <Alert color="green" data-testid="bootstrap-success">
                Primeira instituição registrada com sucesso!
              </Alert>
            )}

            {success && effectivelyBootstrapped && (
              <Alert color="green">Proposta registrada com sucesso!</Alert>
            )}

            <form onSubmit={handleSubmit}>
              <Stack>
                <TextInput
                  label="Endereço"
                  placeholder="0x..."
                  value={form.address}
                  onChange={(e) => updateField('address', e.target.value)}
                  error={errors.address}
                />
                <TextInput
                  label="Nome"
                  placeholder="Nome da instituição"
                  value={form.name}
                  onChange={(e) => updateField('name', e.target.value)}
                  error={errors.name}
                />
                <TextInput
                  label="Área de Atuação"
                  placeholder="Ex: educação, saúde"
                  value={form.areaOfWork}
                  onChange={(e) => updateField('areaOfWork', e.target.value)}
                  error={errors.areaOfWork}
                />
                <Button type="submit" loading={loading}>
                  {effectivelyBootstrapped ? 'Propor' : 'Registrar Primeira Instituição'}
                </Button>
              </Stack>
            </form>
          </Stack>
        </Card>
      </Stack>
    </Center>
  )
}
