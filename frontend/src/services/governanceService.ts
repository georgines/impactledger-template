import { isAddress, type Provider, type EventLog } from 'ethers'
import { getGovernanceDAOContract } from '@/services/contractService'
import { translateContractError } from '@/services/contractErrors'

export enum ProposalStatus {
  Active = 0,
  Approved = 1,
  Rejected = 2,
  Executed = 3,
}

export const PROPOSAL_STATUS_LABELS: Record<number, string> = {
  [ProposalStatus.Active]: 'Em Votação',
  [ProposalStatus.Approved]: 'APROVADA',
  [ProposalStatus.Rejected]: 'REJEITADA',
  [ProposalStatus.Executed]: 'EXECUTADA',
}

export const PROPOSAL_STATUS_COLORS: Record<number, string> = {
  [ProposalStatus.Active]: 'blue',
  [ProposalStatus.Approved]: 'green',
  [ProposalStatus.Rejected]: 'red',
  [ProposalStatus.Executed]: 'gray',
}

export const PROPOSAL_KIND_LABELS: Record<number, string> = {
  0: 'Aprovar Instituição',
  1: 'Aprovar Fornecedor',
  2: 'Pausar Instituição',
  3: 'Despausar Instituição',
  4: 'Remover Instituição',
}

// Espelha exatamente o struct Proposal do contrato GovernanceDAO.
// yesWeight/noWeight correspondem aos campos do contrato.
// status usa mapContractStatus para alinhar enum frontend↔contrato.
export interface Proposal {
  proposalId: bigint
  kind: number
  target: string
  snapshotBlock: bigint
  deadline: bigint
  status: ProposalStatus
  yesWeight: bigint
  noWeight: bigint
  quorum: bigint
  nameMetadataHash: string
  name: string
  metadata: string
}

// Contrato: Active=0, Executed=1, Rejected=2
// Frontend: Active=0, Approved=1(virtual), Rejected=2, Executed=3
// Converte o status numérico do contrato para o enum ProposalStatus do frontend.
function mapContractStatus(raw: number): ProposalStatus {
  if (raw === 1) return ProposalStatus.Executed
  if (raw === 2) return ProposalStatus.Rejected
  return ProposalStatus.Active
}

// Traduz erro de votação em mensagem legível em português.
export function translateVoteError(err: unknown): string {
  return translateContractError(err)
}

// Calcula o percentual de progresso da votação em relação ao quórum (0-100).
export function votingProgressPercent(totalWeight: bigint, quorum: bigint): number {
  if (quorum === BigInt(0)) return 100
  const pct = Number((totalWeight * BigInt(100)) / quorum)
  return Math.min(pct, 100)
}

// Traduz erro de finalização de proposta em mensagem legível em português.
export function translateFinalizeError(err: unknown): string {
  return translateContractError(err)
}

// Consulta o contrato para saber se o bootstrap inicial já foi executado.
export async function fetchIsBootstrapped(provider: Provider): Promise<boolean> {
  const contract = getGovernanceDAOContract(provider)
  return contract.bootstrapped() as Promise<boolean>
}

// Consulta se um endereço já votou em uma proposta específica.
export async function fetchHasVoted(
  proposalId: bigint,
  address: string,
  provider: Provider,
): Promise<boolean> {
  const contract = getGovernanceDAOContract(provider)
  return contract.hasVoted(proposalId, address) as Promise<boolean>
}

// Busca os dados atualizados de uma proposta individual mantendo name/metadata do evento original.
export async function fetchSingleProposal(
  proposalId: bigint,
  provider: Provider,
  original: Pick<Proposal, 'name' | 'metadata'>,
): Promise<Proposal> {
  const contract = getGovernanceDAOContract(provider)
  const data = await contract.getProposal(proposalId)

  return {
    proposalId: data.id as bigint,
    kind: Number(data.kind),
    target: data.target as string,
    snapshotBlock: data.snapshotBlock as bigint,
    deadline: data.deadline as bigint,
    status: mapContractStatus(Number(data.status)),
    yesWeight: data.yesWeight as bigint,
    noWeight: data.noWeight as bigint,
    quorum: data.quorum as bigint,
    nameMetadataHash: data.nameMetadataHash as string,
    name: original.name,
    metadata: original.metadata,
  }
}

// Busca todas as propostas via eventos ProposalCreated e enriquece com dados do contrato.
export async function fetchProposals(provider: Provider): Promise<Proposal[]> {
  const contract = getGovernanceDAOContract(provider)
  const filter = contract.filters.ProposalCreated()
  const events = await contract.queryFilter(filter)

  return Promise.all(
    events.map(async (event) => {
      const log = event as EventLog
      const proposalId = log.args.proposalId as bigint
      const name = (log.args.name as string) ?? ''
      const metadata = (log.args.metadata as string) ?? ''

      const data = await contract.getProposal(proposalId)

      return {
        proposalId: data.id as bigint,
        kind: Number(data.kind),
        target: data.target as string,
        snapshotBlock: data.snapshotBlock as bigint,
        deadline: data.deadline as bigint,
        status: mapContractStatus(Number(data.status)),
        yesWeight: data.yesWeight as bigint,
        noWeight: data.noWeight as bigint,
        quorum: data.quorum as bigint,
        nameMetadataHash: data.nameMetadataHash as string,
        name,
        metadata,
      }
    }),
  )
}

/// Formata o tempo restante até o deadline da proposta.
/// nowSeconds: Unix timestamp em segundos (padrão: Date.now()/1000).
export function formatTimeRemaining(deadlineTimestamp: bigint, nowSeconds?: number): string {
  const now = nowSeconds ?? Math.floor(Date.now() / 1000)
  const remaining = Number(deadlineTimestamp) - now

  if (remaining <= 0) return 'Expirada'

  const days = Math.floor(remaining / 86400)
  const hours = Math.floor((remaining % 86400) / 3600)
  const minutes = Math.floor((remaining % 3600) / 60)

  if (days > 0) return `${days}d ${hours}h`
  if (hours > 0) return `${hours}h ${minutes}min`
  return `${minutes}min`
}

/// Deriva o status efetivo para exibição no frontend.
/// O contrato só muda o status ao chamar finalize(); esta função
/// reflete o estado real sem exigir transação.
/// Aprovação exige: prazo expirado + yesWeight > noWeight + quórum atingido.
export function computeEffectiveStatus(
  proposal: Pick<Proposal, 'status' | 'deadline' | 'yesWeight' | 'noWeight' | 'quorum'>,
  nowSeconds?: number,
): ProposalStatus {
  if (proposal.status !== ProposalStatus.Active) return proposal.status

  const now = nowSeconds ?? Math.floor(Date.now() / 1000)
  const deadlinePassed = Number(proposal.deadline) <= now

  if (!deadlinePassed) return ProposalStatus.Active

  const totalWeight = proposal.yesWeight + proposal.noWeight
  const quorumReached = totalWeight >= proposal.quorum
  const yesWins = proposal.yesWeight > proposal.noWeight

  if (quorumReached && yesWins) return ProposalStatus.Approved
  return ProposalStatus.Rejected
}

// Retorna o rótulo de exibição do status efetivo de uma proposta.
export function getProposalStatusLabel(
  proposal: Pick<Proposal, 'status' | 'deadline' | 'yesWeight' | 'noWeight' | 'quorum'>,
  nowSeconds?: number,
): string {
  const effective = computeEffectiveStatus(proposal, nowSeconds)
  if (effective === ProposalStatus.Executed) return 'APROVADA'
  if (effective === ProposalStatus.Rejected) {
    const totalWeight = proposal.yesWeight + proposal.noWeight
    if (totalWeight < proposal.quorum) return 'QUÓRUM NÃO ATINGIDO'
    return 'REJEITADA'
  }
  return PROPOSAL_STATUS_LABELS[effective] ?? String(effective)
}

export interface FormState {
  kind: string
  target: string
  name: string
  metadata: string
}

export interface FormErrors {
  kind?: string
  target?: string
  name?: string
  metadata?: string
}

// Kinds que exibem campo Nome (name). Todos os kinds exigem metadata.
export const KINDS_REQUIRING_NAME = new Set(['0', '1'])

// Retorna o rótulo do campo metadata conforme o tipo de proposta.
export function getMetadataLabel(kind: string): string {
  if (kind === '0') return 'Área de Atuação'
  if (kind === '1') return 'Tipo de Serviço'
  return 'Motivo da Proposta'
}

// Retorna o placeholder do campo metadata conforme o tipo de proposta.
export function getMetadataPlaceholder(kind: string): string {
  if (kind === '0') return 'Ex: educação, saúde'
  if (kind === '1') return 'Ex: logística, tecnologia'
  return 'Descreva o motivo desta proposta'
}

export interface BootstrapFormState {
  address: string
  name: string
  areaOfWork: string
}

export interface BootstrapFormErrors {
  address?: string
  name?: string
  areaOfWork?: string
}

// Valida o formulário de bootstrap e retorna erros por campo.
export function validateBootstrapForm(form: BootstrapFormState): BootstrapFormErrors {
  const errors: BootstrapFormErrors = {}

  if (!form.address) {
    errors.address = 'Endereço obrigatório'
  } else if (!isAddress(form.address)) {
    errors.address = 'Endereço inválido'
  }

  if (!form.name.trim()) errors.name = 'Nome obrigatório'
  if (!form.areaOfWork.trim()) errors.areaOfWork = 'Área de atuação obrigatória'

  return errors
}

// Valida o formulário de nova proposta e retorna erros por campo.
export function validateProposalForm(form: FormState): FormErrors {
  const errors: FormErrors = {}

  if (!form.kind) errors.kind = 'Selecione o tipo de proposta'

  if (!form.target) {
    errors.target = 'Endereço obrigatório'
  } else if (!isAddress(form.target)) {
    errors.target = 'Endereço inválido'
  }

  if (KINDS_REQUIRING_NAME.has(form.kind)) {
    if (!form.name.trim()) errors.name = 'Nome obrigatório'
  }

  if (form.kind) {
    if (!form.metadata.trim()) errors.metadata = 'Campo obrigatório'
  }

  return errors
}

// Lê o quórum mínimo configurado no contrato GovernanceDAO.
export async function fetchMinQuorum(provider: Provider): Promise<bigint> {
  const contract = getGovernanceDAOContract(provider)
  return contract.minQuorum() as Promise<bigint>
}
