# Demonstração Funcional: Capturas de Tela

[Início](../../README.md)

Todas as capturas mostram dados reais registrados na blockchain local (Anvil). Cada endereço corresponde a um papel diferente detectado on-chain. Estado gerado pelo ciclo completo de testes: 3 instituições, 3 fornecedores aprovados via DAO, 6 pedidos pagos com Prova de Impacto.

---

## Acesso público: Mapa do Bem

Qualquer pessoa acessa sem precisar conectar carteira. Tudo vem diretamente da blockchain.

<p align="center">
  <img src="../img/screenshots/01b-mapa-do-bem-com-dados.png" alt="Mapa do Bem com dados reais" width="100%"/>
</p>

45 ETH doados, 9 ETH pagos com prova, 3 instituições registradas. Leitura direta da chain, sem intermediários.

---

## Operador

O sistema detecta on-chain que o endereço é o Operador e exibe apenas as seções correspondentes.

### Dashboard

<p align="center">
  <img src="../img/screenshots/02-operador-inicio.png" alt="Dashboard do Operador" width="100%"/>
</p>

### Listar Instituições

<p align="center">
  <img src="../img/screenshots/06-operador-instituicoes.png" alt="Instituições registradas" width="100%"/>
</p>

3 instituições ATIVAS: Instituto Esperança (educação), Fundação Saúde Viva (saúde), Casa Animal Feliz (proteção animal). Aprovadas pela DAO, status registrado on-chain.

### Cadastrar Instituição (bootstrap)

<p align="center">
  <img src="../img/screenshots/04b-operador-cadastro-preenchido.png" alt="Formulário de bootstrap preenchido" width="100%"/>
</p>

<p align="center">
  <img src="../img/screenshots/04c-operador-bootstrap-sucesso.png" alt="Bootstrap registrado com sucesso" width="100%"/>
</p>

Registro inicial: função usada uma única vez para criar a primeira instituição sem votação. Após o uso, fica bloqueada permanentemente.

### Propostas em Votação

<p align="center">
  <img src="../img/screenshots/03-operador-votacao.png" alt="Propostas em votação" width="100%"/>
</p>

Fila vazia. Todas as propostas foram finalizadas após quórum de votação quadrática atingido.

### Cadastrar Fornecedor

<p align="center">
  <img src="../img/screenshots/05-operador-cadastro-forn.png" alt="Cadastrar fornecedor" width="100%"/>
</p>

O operador propõe; a aprovação passa por votação da DAO, não há cadastro manual.

### Saldo da Plataforma

<p align="center">
  <img src="../img/screenshots/07-operador-saldo.png" alt="Saldo da plataforma" width="100%"/>
</p>

45 ETH histórico de doações; 36 ETH em caixa distribuídos entre as 3 instituições ativas.

---

## Doador

### Dashboard

<p align="center">
  <img src="../img/screenshots/08-doador-inicio.png" alt="Dashboard do Doador" width="100%"/>
</p>

Badge "VOCÊ É UM DOADOR!" detectado on-chain. Mapa do Bem em tempo real com todas as transações.

### Fazer Doação

<p align="center">
  <img src="../img/screenshots/09-doador-fazer-doacao.png" alt="Página de doação" width="100%"/>
</p>

<p align="center">
  <img src="../img/screenshots/09b-doador-doacao-preenchida.png" alt="Modal de doação preenchido" width="100%"/>
</p>

<p align="center">
  <img src="../img/screenshots/09c-doador-doacao-sucesso.png" alt="Doação realizada com sucesso" width="100%"/>
</p>

### Votação

<p align="center">
  <img src="../img/screenshots/10-doador-votacao.png" alt="Proposta em votação" width="100%"/>
</p>

Proposta real de aprovação de fornecedor com quórum calculado por votação quadrática (`√total_doado`).

---

## Instituição

### Dashboard

<p align="center">
  <img src="../img/screenshots/11-instituicao-inicio.png" alt="Dashboard da Instituição" width="100%"/>
</p>

Badge "VOCÊ É UMA INSTITUIÇÃO!" detectado on-chain. Mapa do Bem mostra os 6 pedidos concluídos com Prova de Impacto.

### Saldo

<p align="center">
  <img src="../img/screenshots/12-instituicao-saldo.png" alt="Saldo da instituição" width="100%"/>
</p>

17.0 ETH disponível; saldo bloqueado zerado após 2 pedidos pagos (1 ETH + 2 ETH liberados ao fornecedor).

### Novo Pedido

<p align="center">
  <img src="../img/screenshots/13-instituicao-novo-pedido.png" alt="Criar novo pedido" width="100%"/>
</p>

3 fornecedores aprovados pela DAO disponíveis: LogTech Soluções, DataImpacto Tecnologia, VetSupply Brasil. O contrato rejeita pagamento para qualquer endereço fora da whitelist.

### Pedidos de Compra

<p align="center">
  <img src="../img/screenshots/17-instituicao-pedidos-de-compra.png" alt="Pedidos de compra da instituição" width="100%"/>
</p>

2 pedidos concluídos com status PAGO e hash da Prova de Impacto registrado on-chain.

### Meus Recebimentos

<p align="center">
  <img src="../img/screenshots/18-instituicao-meus-recebimentos.png" alt="Meus recebimentos com prova de impacto" width="100%"/>
</p>

Histórico de recebimentos com link direto para a Prova de Impacto armazenada na blockchain.

---

## Fornecedor

### Dashboard

<p align="center">
  <img src="../img/screenshots/14-fornecedor-inicio.png" alt="Dashboard do Fornecedor" width="100%"/>
</p>

Badge "VOCÊ É UM FORNECEDOR!": aprovação por proposta + votação da DAO, executada on-chain.

### Pedidos Recebidos

<p align="center">
  <img src="../img/screenshots/15-fornecedor-pedidos.png" alt="Pedidos recebidos" width="100%"/>
</p>

2 pedidos PAGOS de instituições diferentes: Instituto Esperança (1.0 ETH) e Fundação Saúde Viva (1.5 ETH).

### Histórico de Recebimentos

<p align="center">
  <img src="../img/screenshots/16-fornecedor-saldo.png" alt="Histórico de recebimentos" width="100%"/>
</p>

Tabela com pedido, instituição pagadora, valor, data e hash da transação. Auditável publicamente.

---

[← Contratos publicados na Sepolia](../contratos.md) | [Vídeo de demonstração →](video.md)
