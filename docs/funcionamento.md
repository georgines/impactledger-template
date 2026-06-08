# Funcionamento da Plataforma

[Início](../README.md)

---


## Fluxo principal: do cadastro ao impacto comprovado

```
1. Operador abre proposta → aprovar Instituição
         ↓
2. Doadores votam (peso = √total_doado) → quórum → qualquer participante aciona
         ↓
3. Doador envia ETH → saldo isolado da Instituição (não mistura com outras)
         ↓
4. Instituição cria pedido para Fornecedor da whitelist → valor bloqueado
         ↓
5. Fornecedor entrega e confirma on-chain
         ↓
6. Instituição confirma recebimento + envia Prova de Impacto ao IPFS
         ↓
7. Contrato valida o hash → libera pagamento ao Fornecedor em ETH
         ↓
8. Registro imutável público no Mapa do Bem
```

---

## Fluxo de governança (DAO)

Todas as decisões que afetam a plataforma passam por votação coletiva:

| Ação | Quem propõe | Quem vota | Execução |
|---|---|---|---|
| Aprovar nova Instituição | Operador | Doadores | Qualquer participante finaliza após quórum |
| Aprovar novo Fornecedor | Operador | Doadores | Qualquer participante finaliza após quórum |
| Pausar Instituição | Operador | Doadores | Qualquer participante finaliza após quórum |
| Despausar Instituição | Operador | Doadores | Qualquer participante finaliza após quórum |
| Remover Instituição | Operador | Doadores | Qualquer participante finaliza; saldo vai ao Cofre Central |

**Peso do voto:** calculado por votação quadrática. Veja [como funciona na seção A ideia](../README.md#a-ideia).

**Quórum:** Se o peso total de votos atingir o mínimo antes do prazo, qualquer participante pode acionar a finalização. O contrato executa a ação imediatamente. Se o prazo expirar sem quórum, a proposta é rejeitada sem efeito.

---

## Resolução de disputas

Disputas acontecem quando uma das partes não cumpre seu prazo. Quem pode abrir a disputa depende do caso:

### Disputa contra o Fornecedor (Instituição abre)
- Prazo de entrega expira sem confirmação do Fornecedor
- Instituição aciona `openDispute`
- O botão "Confirmar Entrega" some para o Fornecedor

### Disputa contra a Instituição (Fornecedor abre)
- Fornecedor confirma entrega, mas Instituição não confirma recebimento no prazo
- Fornecedor aciona `openDispute`

**Durante a disputa:**
1. Valor permanece bloqueado no contrato
2. Ambas as partes enviam evidências ao IPFS e registram hashes on-chain
3. Doadores votam com peso quadrático
4. Quórum atingido → qualquer participante aciona a finalização; o contrato executa o veredicto:
   - Fornecedor vence → pagamento liberado
   - Instituição vence → valor devolvido ao saldo da Instituição

---

## Bootstrap: cadastrando a primeira Instituição

Há um problema de ovo e galinha: para aprovar instituições é preciso ter doadores com poder de voto; para ter doadores com poder de voto é preciso ter uma instituição ativa.

**Solução:** O Operador tem acesso a uma função de registro inicial, uma "chave mestra" que cadastra a primeira instituição sem votação. Após o uso, essa função se destrói e nunca mais pode ser usada, nem pelo próprio Operador.

---

## Mapa do Bem: auditoria pública

A tela inicial da plataforma (`/`) é pública e não exige carteira conectada. Qualquer pessoa pode ver:

- Todas as doações recebidas pelas instituições
- Todos os pagamentos feitos a fornecedores
- O valor, a instituição, o fornecedor e o link para a Prova de Impacto de cada transação
- Totais: quanto foi doado, quanto foi pago com prova registrada, quantas instituições participaram

Os dados vêm diretamente da blockchain e não podem ser adulterados por ninguém.

---

## Área de cada ator

### Operador de Plataforma

| Seção | Rota |
|---|---|
| Início | `/inicio` |
| Propostas em votação | `/em-votacao` |
| Histórico de votações | `/historico-de-votacoes` |
| Caixa global | `/saldo` |
| Cadastrar Instituição | `/cadastro/instituicoes` |
| Cadastrar Fornecedor | `/cadastro/fornecedores` |
| Lista de Instituições | `/instituicoes` |
| Lista de Fornecedores | `/fornecedores` |

### Doador

| Seção | Rota |
|---|---|
| Início | `/inicio` |
| Propostas em votação | `/em-votacao` |
| Histórico de votações | `/historico-de-votacoes` |
| Fazer doação | `/fazer-doacao` |
| Minhas doações | `/minhas-doacoes` |
| Disputas ativas (votar) | `/disputas-ativas` |

### Instituição

| Seção | Rota |
|---|---|
| Início | `/inicio` |
| Caixa | `/saldo` |
| Novo pedido | `/novo-pedido` |
| Pedidos de compra | `/pedidos-de-compra` |
| Meus recebimentos | `/meus-recebimentos` |
| Minhas disputas | `/minhas-disputas` |

### Fornecedor

| Seção | Rota |
|---|---|
| Início | `/inicio` |
| Caixa | `/saldo` |
| Pedidos recebidos | `/pedidos-recebidos` |
| Minhas disputas | `/minhas-disputas` |

---

[← Quais tecnologias foram usadas](tecnologias.md) | [Contratos publicados na Sepolia: endereços e Etherscan →](contratos.md)
