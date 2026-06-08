import { Interface, id, ErrorFragment } from 'ethers'
import GovernanceDAOABI from '@/abis/GovernanceDAO.json'
import TreasuryABI from '@/abis/Treasury.json'
import InstitutionRegistryABI from '@/abis/InstitutionRegistry.json'
import PurchaseManagerABI from '@/abis/PurchaseManager.json'

// ---------------------------------------------------------------------------
// Mensagens em português para todos os custom errors dos contratos
// ---------------------------------------------------------------------------

const ALL_CONTRACT_ERROR_MESSAGES: Record<string, string> = {
  // GovernanceDAO
  GovernanceDAO__OnlyOperator: 'Apenas o operador pode executar esta ação.',
  GovernanceDAO__ZeroAddress: 'Endereço inválido.',
  GovernanceDAO__ProposalNotFound: 'Proposta não encontrada.',
  GovernanceDAO__NotActive: 'Esta proposta não está mais ativa.',
  GovernanceDAO__VotingEnded: 'O prazo de votação encerrou.',
  GovernanceDAO__AlreadyVoted: 'Você já votou nesta proposta.',
  GovernanceDAO__NoVotingPower: 'Você não tem poder de voto nesta proposta.',
  GovernanceDAO__NotFinalizable:
    'A proposta ainda não pode ser finalizada. Aguarde o prazo encerrar.',
  GovernanceDAO__InvalidNameMetadata:
    'Dados da proposta inválidos. Recarregue a página e tente novamente.',
  GovernanceDAO__AlreadyBootstrapped:
    'A plataforma já foi inicializada. O registro inicial só pode ser feito uma vez.',

  // InstitutionRegistry
  InstitutionRegistry__OnlyGovernance: 'Apenas a governança pode executar esta ação.',
  InstitutionRegistry__ZeroAddress: 'Endereço inválido.',
  InstitutionRegistry__AlreadyRegistered: 'Esta instituição já está registrada.',
  InstitutionRegistry__InvalidTransition: 'Transição de status inválida.',

  // PurchaseManager
  PurchaseManager__OnlyGovernance: 'Apenas a governança pode executar esta ação.',
  PurchaseManager__ZeroAddress: 'Endereço inválido.',
  PurchaseManager__ZeroAmount: 'O valor deve ser maior que zero.',
  PurchaseManager__InvalidDeadline: 'Prazo inválido.',
  PurchaseManager__InstitutionNotActive: 'Instituição não está ativa.',
  PurchaseManager__OnlyInstitution: 'Apenas a instituição responsável pode executar esta ação.',
  PurchaseManager__OnlySupplier: 'Apenas o fornecedor contratado pode executar esta ação.',
  PurchaseManager__OnlyParty: 'Apenas uma das partes pode executar esta ação.',
  PurchaseManager__InvalidStatus: 'Status inválido para esta operação.',
  PurchaseManager__DeadlineNotExpired: 'O prazo ainda não expirou.',
  PurchaseManager__DisputeWindowClosed: 'O período de disputa está encerrado.',
  PurchaseManager__EmptyProofHash: 'O comprovante de impacto não pode ser vazio.',
  PurchaseManager__ProofAlreadySubmitted: 'O comprovante já foi enviado para este pedido.',
  PurchaseManager__NotFinalizable: 'O pedido de compra ainda não pode ser finalizado.',
  PurchaseManager__AlreadyVoted: 'Você já votou nesta disputa.',
  PurchaseManager__NoVotingPower: 'Você não tem poder de voto nesta disputa.',
  PurchaseManager__PurchaseNotFound: 'Pedido de compra não encontrado.',

  // Treasury
  Treasury__OnlyGovernance: 'Apenas a governança pode executar esta ação.',
  Treasury__OnlyPurchaseManager: 'Apenas o gerenciador de compras pode executar esta ação.',
  Treasury__ZeroAddress: 'Endereço inválido.',
  Treasury__ZeroAmount: 'O valor deve ser maior que zero.',
  Treasury__InstitutionNotActive: 'Instituição não está ativa.',
  Treasury__InsufficientBalance: 'Saldo insuficiente para esta operação.',
  Treasury__InsufficientReserved: 'Valor reservado insuficiente.',
  Treasury__TransferFailed: 'Falha na transferência de fundos. Tente novamente.',

  // SupplierRegistry (library interna, errors embutidos na ABI do PurchaseManager)
  SupplierRegistry__NotWhitelisted:
    'Este fornecedor não está aprovado na lista de fornecedores confiáveis.',
  SupplierRegistry__AlreadyWhitelisted: 'Este fornecedor já está aprovado.',
  SupplierRegistry__ZeroAddress: 'Endereço inválido.',
}

// ---------------------------------------------------------------------------
// Mensagens para erros de carteira/provider (ethers) reconhecidos pelo `code`
// ---------------------------------------------------------------------------

const WALLET_ERROR_MESSAGES: Record<string, string> = {
  INSUFFICIENT_FUNDS: 'Saldo insuficiente na carteira para cobrir o valor e a taxa de rede.',
  CALL_EXCEPTION:
    'Não foi possível simular a transação. Verifique os dados informados ou tente novamente.',
  UNPREDICTABLE_GAS_LIMIT:
    'Não foi possível simular a transação. Verifique os dados informados ou tente novamente.',
  NETWORK_ERROR: 'Falha de conexão com a rede. Verifique sua internet e tente novamente.',
  TIMEOUT: 'Falha de conexão com a rede. Verifique sua internet e tente novamente.',
  NONCE_EXPIRED: 'Já existe uma transação pendente. Aguarde ela confirmar ou ajuste a taxa de gás.',
  REPLACEMENT_UNDERPRICED:
    'Já existe uma transação pendente. Aguarde ela confirmar ou ajuste a taxa de gás.',
}

// ---------------------------------------------------------------------------
// Mapa de seletor hex → nome do erro, construído a partir das ABIs em tempo
// de carregamento do módulo. Cobre o caso em que o ethers não consegue
// decodificar o erro e retorna "unknown custom error" no message, mas ainda
// fornece o selector bruto em err.data.
// ---------------------------------------------------------------------------

function buildErrorSelectorMap(): Map<string, string> {
  const abis = [GovernanceDAOABI, TreasuryABI, InstitutionRegistryABI, PurchaseManagerABI]
  const map = new Map<string, string>()

  for (const abi of abis) {
    try {
      const iface = new Interface(abi as never)
      for (const fragment of iface.fragments) {
        if (fragment.type !== 'error') continue
        const errFrag = fragment as ErrorFragment
        const signature = errFrag.format()
        const selector = id(signature).slice(0, 10).toLowerCase()
        map.set(selector, errFrag.name)
      }
    } catch {
      // ignora ABI inválida
    }
  }

  return map
}

const ERROR_SELECTOR_MAP = buildErrorSelectorMap()

// ---------------------------------------------------------------------------
// Função principal de tradução — única para todos os contratos
// ---------------------------------------------------------------------------

/**
 * Traduz qualquer erro de contrato/carteira para uma mensagem legível em português.
 *
 * Estratégia (em ordem):
 * 1. Rejeição de assinatura pelo usuário (code 4001 / ACTION_REJECTED)
 * 2. Código de erro de carteira/provider conhecido (ethers ErrorCode)
 * 3. Seletor hex em `err.data` — cobre o caso "unknown custom error" do ethers
 * 4. Nome do erro em `err.message` — cobre o caso em que o ethers decodificou
 * 5. Mensagem genérica como fallback
 */
export function translateContractError(err: unknown): string {
  const code = err != null ? (err as { code?: number | string }).code : undefined
  const message = err instanceof Error ? err.message : ''

  // 1. Rejeição de assinatura pelo usuário (MetaMask code 4001 / ACTION_REJECTED)
  if (code === 4001 || code === 'ACTION_REJECTED' || message.includes('ACTION_REJECTED')) {
    return 'Transação cancelada pelo usuário.'
  }

  // 2. Código de erro de carteira/provider conhecido (ethers ErrorCode)
  if (typeof code === 'string' && WALLET_ERROR_MESSAGES[code]) {
    return WALLET_ERROR_MESSAGES[code]
  }

  // 3. Matching por seletor em err.data
  const data = err != null ? (err as { data?: string }).data : undefined
  if (typeof data === 'string' && data.length >= 10) {
    const selector = data.slice(0, 10).toLowerCase()
    const errorName = ERROR_SELECTOR_MAP.get(selector)
    if (errorName) {
      const humanMessage = ALL_CONTRACT_ERROR_MESSAGES[errorName]
      if (humanMessage) return humanMessage
    }
  }

  // 4. Matching por nome em err.message
  for (const [errorName, humanMessage] of Object.entries(ALL_CONTRACT_ERROR_MESSAGES)) {
    if (message.includes(errorName)) return humanMessage
  }

  // 5. Fallback genérico
  return 'Ocorreu um erro inesperado. Tente novamente.'
}
