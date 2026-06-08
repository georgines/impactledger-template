import type { AuthenticatedRole } from '@/hooks/useActorRole'

export const ROUTE_ROLES: Record<string, AuthenticatedRole[]> = {
  '/inicio': ['operador', 'instituicao', 'fornecedor', 'doador'],
  '/em-votacao': ['operador', 'doador'],
  '/historico-de-votacoes': ['operador', 'doador'],
  '/fazer-doacao': ['doador'],
  '/minhas-doacoes': ['doador'],
  '/pedidos-de-compra': ['instituicao'],
  '/novo-pedido': ['instituicao'],
  '/pedidos-recebidos': ['fornecedor'],
  '/meus-recebimentos': ['instituicao'],
  '/disputas-ativas': ['doador'],
  '/minhas-disputas': ['instituicao', 'fornecedor'],
  '/historico-disputas': ['doador', 'instituicao', 'fornecedor', 'operador'],
  '/saldo': ['operador', 'instituicao', 'fornecedor'],
  '/cadastro/instituicoes': ['operador'],
  '/instituicoes': ['operador'],
  '/cadastro/fornecedores': ['operador'],
  '/fornecedores': ['operador'],
}
