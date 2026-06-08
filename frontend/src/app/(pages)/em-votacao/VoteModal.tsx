'use client'

import { Alert, Button, Group, Modal, Stack, Text } from '@mantine/core'
import type { Proposal } from '@/services/governanceService'
import {
  PROPOSAL_KIND_LABELS,
  KINDS_REQUIRING_NAME,
  getMetadataLabel,
} from '@/services/governanceService'

interface VoteModalProps {
  proposal: Pick<Proposal, 'proposalId' | 'kind' | 'name' | 'metadata'>
  isOpen: boolean
  voting: boolean
  voteError: string | null
  onClose: () => void
  onVote: (support: boolean) => Promise<void>
}

export function VoteModal({
  proposal,
  isOpen,
  voting,
  voteError,
  onClose,
  onVote,
}: VoteModalProps) {
  const kindLabel = PROPOSAL_KIND_LABELS[proposal.kind] ?? `Tipo ${proposal.kind}`
  const kindStr = String(proposal.kind)
  const showName = KINDS_REQUIRING_NAME.has(kindStr)
  const metadataLabel = getMetadataLabel(kindStr)

  return (
    <Modal opened={isOpen} onClose={onClose} title="Votação" centered>
      <Stack gap="md">
        <Text fw={600}>Você concorda com essa mudança?</Text>

        <Stack gap="xs">
          <Text size="sm" c="dimmed">
            {kindLabel}
          </Text>

          {showName && proposal.name && (
            <Text size="sm">
              <Text span fw={500}>
                Nome:{' '}
              </Text>
              {proposal.name}
            </Text>
          )}

          {proposal.metadata && (
            <Text size="sm">
              <Text span fw={500}>
                {metadataLabel}:{' '}
              </Text>
              {proposal.metadata}
            </Text>
          )}
        </Stack>

        {voteError && (
          <Alert color="red">
            <Text size="sm">{voteError}</Text>
          </Alert>
        )}

        <Group grow>
          <Button
            color="green"
            loading={voting}
            onClick={() => onVote(true)}
            data-testid="btn-concordo"
          >
            Concordo
          </Button>
          <Button
            color="red"
            variant="light"
            loading={voting}
            onClick={() => onVote(false)}
            data-testid="btn-nao-concordo"
          >
            Não concordo
          </Button>
        </Group>
      </Stack>
    </Modal>
  )
}
