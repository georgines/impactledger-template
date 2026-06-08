'use client'

import { useState } from 'react'
import { Alert, Button, Card, Center, Stack, Text, TextInput, Title } from '@mantine/core'
import { useWallet } from '@/hooks/useWallet'
import { useGovernance, type ProposalInput } from '@/hooks/useGovernance'
import {
  validateProposalForm,
  getMetadataLabel,
  getMetadataPlaceholder,
  type FormErrors,
} from '@/services/governanceService'

const KIND = '1'
const EMPTY_FORM = { target: '', name: '', metadata: '' }

export default function CadastroFornecedorPage() {
  const { signer, role } = useWallet()
  const { propose, loading, error } = useGovernance(signer)
  const [form, setForm] = useState(EMPTY_FORM)
  const [errors, setErrors] = useState<FormErrors>({})
  const [success, setSuccess] = useState(false)

  if (!signer) {
    return (
      <Stack p="md">
        <Alert color="yellow">
          <Text>Conecte sua carteira para continuar.</Text>
        </Alert>
      </Stack>
    )
  }

  if (role !== 'operador') {
    return (
      <Stack p="md">
        <Alert color="red">
          <Text>Apenas o Operador pode abrir propostas de governança.</Text>
        </Alert>
      </Stack>
    )
  }

  function updateField(field: keyof typeof EMPTY_FORM, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }))
    setErrors((prev) => ({ ...prev, [field]: undefined }))
    setSuccess(false)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const validationErrors = validateProposalForm({ kind: KIND, ...form })
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors)
      return
    }

    const input: ProposalInput = {
      kind: Number(KIND),
      target: form.target,
      name: form.name,
      metadata: form.metadata,
      purchaseId: BigInt(0),
      disputeVerdict: false,
    }

    await propose(input)
    setSuccess(true)
    setForm(EMPTY_FORM)
  }

  return (
    <Center h="100%">
      <Stack w="100%" maw={560}>
        <Card shadow="sm" padding="xl" radius="md" withBorder>
          <Stack>
            <Title order={2}>Cadastrar Fornecedor</Title>

            {error && <Alert color="red">{error}</Alert>}
            {success && <Alert color="green">Proposta registrada com sucesso!</Alert>}

            <form onSubmit={handleSubmit}>
              <Stack>
                <TextInput
                  label="Endereço do Fornecedor"
                  placeholder="0x..."
                  value={form.target}
                  onChange={(e) => updateField('target', e.target.value)}
                  error={errors.target}
                />
                <TextInput
                  label="Nome"
                  placeholder="Nome do fornecedor"
                  value={form.name}
                  onChange={(e) => updateField('name', e.target.value)}
                  error={errors.name}
                />
                <TextInput
                  label={getMetadataLabel(KIND)}
                  placeholder={getMetadataPlaceholder(KIND)}
                  value={form.metadata}
                  onChange={(e) => updateField('metadata', e.target.value)}
                  error={errors.metadata}
                />
                <Button type="submit" loading={loading}>
                  Propor
                </Button>
              </Stack>
            </form>
          </Stack>
        </Card>
      </Stack>
    </Center>
  )
}
