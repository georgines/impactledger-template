'use client'

import { Alert, Badge, Button, Card, Group, Progress, Stack, Text } from '@mantine/core'
import { useEffect, useRef } from 'react'
import type { Signer, Provider } from 'ethers'
import { useFinalizeProposal } from '@/hooks/useFinalizeProposal'
import { useProposalCountdown } from '@/hooks/useProposalCountdown'
import { useVoteStatus } from '@/hooks/useVoteStatus'
import { useVoteModal } from '@/hooks/useVoteModal'
import {
  PROPOSAL_KIND_LABELS,
  PROPOSAL_STATUS_COLORS,
  KINDS_REQUIRING_NAME,
  getMetadataLabel,
  getProposalStatusLabel,
  computeEffectiveStatus,
  votingProgressPercent,
  ProposalStatus,
  type Proposal,
} from '@/services/governanceService'
import { truncateAddress } from '@/lib/format'
import { VoteModal } from './VoteModal'

export interface ProposalCardProps {
  proposal: Proposal
  signer: Signer | null
  provider: Provider | null
  address: string | null
  role: string | null
  hasDonated?: boolean
  onFinalized?: () => void
  onExpired?: (proposalId: bigint) => void
  onVoted?: (proposalId: bigint) => void
  /** Modo somente leitura: oculta prazo, botões e modal de votação */
  readonly?: boolean
}

export function ProposalCard({
  proposal,
  signer,
  provider,
  address,
  role,
  hasDonated = false,
  onFinalized,
  onExpired,
  onVoted,
  readonly = false,
}: ProposalCardProps) {
  const { finalizing, finalizeError, handleFinalize } = useFinalizeProposal(
    signer,
    proposal,
    onFinalized ?? (() => {}),
  )
  const { hasVoted } = useVoteStatus(proposal.proposalId, address, provider)
  const { isOpen, voting, voteError, open, close, submitVote } = useVoteModal(
    signer,
    proposal,
    onVoted ?? (() => {}),
  )
  const countdown = useProposalCountdown(proposal.deadline)
  const expiredNotified = useRef(false)

  // Quando countdown expira, notifica página para buscar só esta proposta.
  // useRef garante que o callback é chamado apenas uma vez por expiração.
  useEffect(() => {
    if (countdown.expired && !expiredNotified.current && onExpired) {
      expiredNotified.current = true
      onExpired(proposal.proposalId)
    }
  }, [countdown.expired, onExpired, proposal.proposalId])

  const kindLabel = PROPOSAL_KIND_LABELS[proposal.kind] ?? `Tipo ${proposal.kind}`
  const effectiveStatus = computeEffectiveStatus(proposal)
  const statusLabel = getProposalStatusLabel(proposal)
  const statusColor = PROPOSAL_STATUS_COLORS[effectiveStatus] ?? 'gray'
  const totalWeight = proposal.yesWeight + proposal.noWeight
  const pct = votingProgressPercent(totalWeight, proposal.quorum)
  const kindStr = String(proposal.kind)
  const showName = KINDS_REQUIRING_NAME.has(kindStr)
  const metadataLabel = getMetadataLabel(kindStr)

  const canFinalize =
    proposal.status === ProposalStatus.Active &&
    (effectiveStatus === ProposalStatus.Approved || effectiveStatus === ProposalStatus.Rejected)

  const canVote =
    role === 'doador' &&
    hasDonated &&
    proposal.status === ProposalStatus.Active &&
    !countdown.expired &&
    !hasVoted

  return (
    <>
      <Card shadow="sm" padding="md" radius="md" withBorder>
        <Stack gap="xs">
          {/* Cabeçalho: tipo + status */}
          <Group justify="space-between" align="flex-start">
            <div>
              <Text fw={600} size="md">
                {kindLabel}
              </Text>
              <Text size="xs" c="dimmed">
                Proposta #{String(proposal.proposalId)}
              </Text>
            </div>
            <Badge
              color={statusColor}
              variant="light"
              data-testid={`proposal-status-${proposal.proposalId}`}
            >
              {statusLabel}
            </Badge>
          </Group>

          {/* Endereço de destino */}
          <Group gap="xs">
            <Text size="sm" c="dimmed" fw={500}>
              Endereço de destino:
            </Text>
            <Text size="sm" ff="monospace" title={proposal.target}>
              {truncateAddress(proposal.target)}
            </Text>
          </Group>

          {/* Nome — apenas para ApproveInstitution e ApproveSupplier */}
          {showName && proposal.name && (
            <Group gap="xs">
              <Text size="sm" c="dimmed" fw={500}>
                Nome:
              </Text>
              <Text size="sm">{proposal.name}</Text>
            </Group>
          )}

          {/* Metadata: área, tipo de serviço ou motivo */}
          {proposal.metadata && (
            <Group gap="xs">
              <Text size="sm" c="dimmed" fw={500}>
                {metadataLabel}:
              </Text>
              <Text size="sm">{proposal.metadata}</Text>
            </Group>
          )}

          {/* Progresso de votos */}
          <Stack gap={4}>
            <Group justify="space-between">
              <Text size="sm" c="dimmed" fw={500}>
                Quórum
              </Text>
              <Text size="sm" c={pct >= 100 ? 'green' : undefined}>
                {pct >= 100 ? 'Atingido ✓' : `${pct}% do quórum`}
              </Text>
            </Group>
            <Progress
              value={pct}
              color={pct >= 100 ? 'green' : 'blue'}
              size="sm"
              radius="xs"
              data-testid={`quorum-progress-${proposal.proposalId}`}
            />
          </Stack>

          {/* Prazo — countdown regressivo atualizado a cada segundo (oculto no modo somente leitura) */}
          {!readonly && (
            <Group gap="xs">
              <Text size="sm" c="dimmed" fw={500}>
                Prazo:
              </Text>
              <Text size="sm" c={countdown.expired ? 'red' : undefined}>
                {countdown.display}
              </Text>
            </Group>
          )}

          {/* Erro de finalização */}
          {finalizeError && (
            <Alert color="red">
              <Text size="sm">{finalizeError}</Text>
            </Alert>
          )}

          {/* Botão Votar — apenas para doadores que ainda não votaram */}
          {canVote && (
            <Button color="blue" variant="light" size="sm" onClick={open}>
              Votar
            </Button>
          )}

          {/* Botão Finalizar */}
          {canFinalize && (
            <Button
              color="orange"
              variant="light"
              size="sm"
              loading={finalizing}
              onClick={handleFinalize}
            >
              Finalizar
            </Button>
          )}
        </Stack>
      </Card>

      {!readonly && (
        <VoteModal
          proposal={proposal}
          isOpen={isOpen}
          voting={voting}
          voteError={voteError}
          onClose={close}
          onVote={submitVote}
        />
      )}
    </>
  )
}
