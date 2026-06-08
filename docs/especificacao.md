# Plataforma Web3 de Transparência Filantrópica (v3)

## Visão geral

Sistema de gestão, rastreabilidade e **comprovação auditável de impacto** de doações em blockchain para instituições sociais. Doadores financiam causas sociais específicas e governam coletivamente como os recursos são distribuídos. Instituições cadastradas executam os gastos com fornecedores previamente auditados. Todo pagamento gera um recibo imutável público.

---

## Atores

**Operador de Plataforma** — dono técnico do contrato. Sobe contratos na rede e pode abrir propostas de modificação. Não tem poder de voto e não executa nada após uma votação — a execução é automática pelo contrato.

**Instituição** — organização social cadastrada via DAO. Administra os recursos alocados ao seu projeto. Solicita produtos e serviços a fornecedores aprovados, confirma o recebimento on-chain e submete as evidências físicas (Proof of Impact) ao IPFS — o contrato valida o hash on-chain antes de liberar o pagamento ao Fornecedor. Não tem poder de voto e não pode abrir propostas.

**Fornecedor** — entidade externa previamente aprovada e incluída na whitelist on-chain pela DAO. Entrega produtos ou serviços à Instituição, confirma a entrega on-chain e recebe o pagamento em ETH após confirmação da Instituição ou resolução de disputa favorável. Pagamentos a endereços fora da whitelist são revertidos automaticamente pelo contrato.

**Doadores** — podem doar quantas vezes quiserem para a causa social de sua escolha dentro da plataforma (ex: abrigo de animais, distribuição de alimentos). Não propõem mudanças. Votam nas propostas abertas pelo Operador e nas disputas entre Instituição e Fornecedor. O peso de voto segue o modelo de **Votação Quadrática**: `votos = sqrt(valor_total_doado)`, reduzindo a dominância de grandes doadores e preservando o caráter democrático da governança. Quando o quórum é atingido, o contrato executa automaticamente — sem intervenção humana.


---

## Governança DAO

O Operador abre uma proposta on-chain. Os Doadores votam com peso quadrático (`sqrt(valor_total_doado)`). Se o quórum for atingido, o contrato executa automaticamente uma das seguintes ações:

- **Pausar/Despausar uma Instituição** — bloqueia completamente a entrada de doações e a saída de recursos daquela Instituição. Nenhuma doação pode ser direcionada a ela e nenhum gasto pode ser executado enquanto estiver pausada. A despausa reverte esse estado.
- **Remoção de uma Instituição** — revoga o acesso da Instituição à plataforma e transfere o saldo restante ao **Cofre Central** da plataforma (operação O(1), sem iteração sobre arrays). O reaproveitamento desse saldo é submetido a nova rodada de governança para financiamento de novos projetos.
- **Aprovação de nova Instituição** — inclui a organização social na plataforma, habilitando o recebimento de doações e a execução de projetos.
- **Aprovação de novo Fornecedor** — inclui o endereço do fornecedor na whitelist on-chain.

Se o quórum não for atingido e o prazo de validade da votação expirar, a proposta é rejeitada sem efeito.

---

## Fluxo operacional — pagamento

1. Instituição solicita produto ou serviço a um Fornecedor on-chain. O contrato valida que o endereço do Fornecedor está na whitelist aprovada.
2. Contrato valida: Instituição ativa, não pausada e com saldo suficiente. Se válido, abre uma solicitação de compra formal com um prazo de entrega definido e bloqueia o valor no contrato — o saldo fica reservado e não pode ser usado em outra transação.
3. Fornecedor entrega o produto ou executa o serviço e confirma a entrega on-chain.
4. Instituição confirma o recebimento on-chain.
5. Instituição submete o Proof of Impact ao IPFS (fotografias georreferenciadas, laudos ou dados de sensores IoT) e registra o hash on-chain. O contrato valida a existência do hash antes de prosseguir.
6. Contrato libera o pagamento automaticamente ao Fornecedor em ETH.
7. Recibo imutável é gravado na blockchain.

### Caminho alternativo — disputa

Disputas são abertas pela parte prejudicada após o esgotamento do prazo predefinido. O contrato restringe quem pode acionar cada tipo de disputa.

- **Disputa contra o Fornecedor** — o prazo de entrega predefinido expira sem que o Fornecedor tenha confirmado a entrega on-chain. Apenas a **Instituição** do pedido pode acionar a abertura de disputa (`openDispute`). O botão "Confirmar Entrega" some da visão do Fornecedor. O contrato rejeita qualquer outro chamador com `PurchaseManager__OnlyInstitution`.
- **Disputa contra a Instituição** — o Fornecedor confirma a entrega on-chain, mas a Instituição não confirma o recebimento até o prazo predefinido. Apenas o **Fornecedor** do pedido pode acionar a abertura de disputa (`openDispute`). O botão de confirmação some da visão da Instituição. O contrato rejeita qualquer outro chamador com `PurchaseManager__OnlySupplier`.

Em ambos os casos, durante o período de disputa:

- O valor permanece bloqueado no contrato.
- Ambas as partes (Instituição e Fornecedor) podem adicionar evidências on-chain, submetendo os arquivos ao IPFS e registrando os hashes no contrato.
- Doadores votam para resolver a disputa, com peso quadrático.
- Se o quórum for atingido, o contrato executa automaticamente o veredicto: libera o pagamento ao Fornecedor se a entrega for confirmada, ou devolve o valor ao saldo da Instituição se a disputa for resolvida a seu favor.


---

## Caixa

Seção do menu visível para Operador, Instituição e Fornecedor. Cada um vê informações relevantes ao seu papel:

- **Operador**: vê três números globais da plataforma — quanto foi doado ao total desde o início, quanto está guardado agora (nas contas das instituições mais o cofre central) e quanto está no cofre central. Abaixo, uma lista de todas as instituições com o saldo de cada uma, podendo buscar por nome.
- **Instituição**: vê quanto dinheiro tem disponível para fazer novos pedidos e quanto está bloqueado aguardando a conclusão de pedidos já em andamento.
- **Fornecedor**: vê o histórico de pagamentos que já recebeu da plataforma.

O Doador **não tem acesso** a essa seção — suas informações estão em "Minhas Doações".

---

## Mapa do Bem

Painel público da plataforma onde qualquer pessoa pode acompanhar o que está acontecendo com o dinheiro — sem precisar entender blockchain. Não exige carteira conectada.

A tela mostra duas coisas juntas, em ordem do mais recente para o mais antigo: as **doações** que chegaram às instituições e os **pagamentos** feitos a fornecedores. Para cada doação, aparece quem doou, para qual instituição e quanto. Para cada pagamento, aparece o pedido correspondente, a instituição, o fornecedor pago, o valor e o link para as evidências físicas registradas (Proof of Impact).

No topo, três números resumem a situação geral: quanto foi doado no total, quanto foi pago com prova de impacto registrada e quantas instituições diferentes aparecem no histórico.

Um filtro simples permite ver só as doações, só os pagamentos ou tudo junto. Nada é editável — os dados vêm diretamente da blockchain e não podem ser alterados por ninguém.

---

## Bootstrap da Plataforma

### O problema do ovo e da galinha

Para aprovar uma instituição na plataforma, é preciso ter doadores com poder de voto. Para ter doadores com poder de voto, é preciso que já exista uma instituição ativa para receber doações. Ou seja: sem instituição não há doadores, e sem doadores não há como aprovar instituições. A plataforma trava antes de começar.

### A solução: a chave mestra que funciona uma só vez

O administrador da plataforma (Operador) tem acesso a uma função especial chamada **registro inicial**. Ela funciona como uma chave mestra: permite cadastrar a **primeira instituição sem precisar de votação**. Assim que essa chave é usada, ela se destrói automaticamente — nunca mais pode ser usada novamente, por ninguém, nem mesmo pelo Operador.

Como funciona na prática:

1. O Operador usa o registro inicial para cadastrar a primeira instituição.
2. A plataforma começa a aceitar doações para essa instituição.
3. Os primeiros doadores fazem doações e passam a ter poder de voto.
4. A partir daí, toda nova instituição passa pelo processo normal de votação da comunidade.

Garantias:
- Só pode ser feito **uma única vez**. Qualquer tentativa de uso repetido é bloqueada automaticamente.
- O registro fica registrado publicamente na blockchain — qualquer pessoa pode verificar.
- Após o registro inicial, o Operador não tem mais atalhos: tudo passa pela governança.

---

## Requisitos técnicos relevantes

- Separação de saldos por projeto: nenhum projeto acessa verba de outro
- Doações direcionadas: cada doação é vinculada a uma causa específica dentro da plataforma
- Bloqueio de valor: saldo reservado em solicitação de compra fica indisponível para outros gastos
- **Remoção com transferência ao Cofre Central (O(1))**: elimina iteração sobre arrays e o risco de DoS por esgotamento de gas; redistribuição ocorre via nova rodada de governança
- **Whitelist de Fornecedores**: cadastro exige aprovação on-chain pela DAO; pagamentos a endereços não listados são revertidos por modificador
- **Proof of Impact obrigatório**: o contrato rejeita qualquer solicitação de pagamento sem hash IPFS de evidências registrado on-chain
- **Votação Quadrática**: peso de voto calculado como `sqrt(valor_total_doado)`
- Resolução de disputas via votação dos Doadores com execução automática pelo contrato
- Pagamentos e evidências de disputa gravados como eventos, não em storage, para reduzir custo de gas
- Padrão checks-effects-interactions para blindagem contra reentrância
- Custom errors tipados para feedback claro ao frontend
- Cobertura de testes via Foundry
