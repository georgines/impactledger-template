'use client'

import { Alert, Button, Group, Loader, Stack, Text, Title } from '@mantine/core'
import { PageHeader } from '@/components/PageHeader'
import { PageStateDisplay } from '@/components/PageStateDisplay'
import { WalletRequired } from '@/components/WalletRequired'
import { useWallet } from '@/hooks/useWallet'
import { useProposalList } from '@/hooks/useProposalList'
import { useMyDonations } from '@/hooks/useMyDonations'
import { ProposalStatus } from '@/services/governanceService'
import { ProposalCard } from './ProposalCard'

export default function EmVotacaoPage() {
  const { provider, signer, address, role } = useWallet()
  const { proposals, loading, error, refetch, refreshSingleProposal } = useProposalList(provider)
  const { donations } = useMyDonations(address, provider)
  const hasDonated = donations.length > 0

  const activeProposals = proposals.filter((p) => p.status === ProposalStatus.Active)

  if (!provider)
    return <WalletRequired message="Conecte sua carteira para ver as propostas em votação." />

  return (
    <Stack p="md">
      <PageHeader title="Propostas em Votação" onRefresh={refetch} loading={loading} />

      <PageStateDisplay
        loading={loading && !activeProposals.length}
        error={error}
        empty={!loading && !error && activeProposals.length === 0}
        emptyMessage="Não há propostas em votação no momento."
        emptyTestId="empty-proposals"
      />

      {activeProposals.map((proposal) => (
        <ProposalCard
          key={String(proposal.proposalId)}
          proposal={proposal}
          signer={signer ?? null}
          provider={provider}
          address={address}
          role={role}
          hasDonated={hasDonated}
          onFinalized={refetch}
          onExpired={refreshSingleProposal}
          onVoted={refreshSingleProposal}
        />
      ))}
    </Stack>
  )
}
