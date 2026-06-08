'use client'

import { Alert, Button, Group, Loader, Stack, Text, Title } from '@mantine/core'
import { PageHeader } from '@/components/PageHeader'
import { PageStateDisplay } from '@/components/PageStateDisplay'
import { WalletRequired } from '@/components/WalletRequired'
import { useWallet } from '@/hooks/useWallet'
import { useProposalList } from '@/hooks/useProposalList'
import { ProposalStatus } from '@/services/governanceService'
import { ProposalCard } from '@/app/(pages)/em-votacao/ProposalCard'

export default function HistoricoVotacoesPage() {
  const { provider } = useWallet()
  const { proposals, loading, error, refetch } = useProposalList(provider)

  const finalizedProposals = proposals.filter((p) => p.status !== ProposalStatus.Active)

  if (!provider)
    return <WalletRequired message="Conecte sua carteira para ver o histórico de votações." />

  return (
    <Stack p="md">
      <PageHeader title="Histórico de Votações" onRefresh={refetch} loading={loading} />

      <PageStateDisplay
        loading={loading && !finalizedProposals.length}
        error={error}
        empty={!loading && !error && finalizedProposals.length === 0}
        emptyMessage="Nenhuma proposta finalizada até o momento."
        emptyTestId="empty-history"
      />

      {finalizedProposals.map((proposal) => (
        <ProposalCard
          key={String(proposal.proposalId)}
          proposal={proposal}
          signer={null}
          provider={provider}
          address={null}
          role={null}
          readonly
        />
      ))}
    </Stack>
  )
}
