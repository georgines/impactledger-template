# Testes

[Início](../README.md)

---


## Visão geral

O projeto tem três camadas de testes:

| Camada | Ferramenta | O que testa |
|---|---|---|
| Contratos Solidity | Foundry (forge test) | Regras de negócio, permissões, custom errors, eventos, saldo isolado |
| Frontend unitário | Vitest | Hooks, services e componentes React |
| Interface E2E | Playwright | Fluxo completo de ponta a ponta com contratos reais |

---

## Rodando os testes

### Todos os testes (contratos + frontend)

```bash
cd ~/projetos/projeto_final
yarn test
```

### Só contratos (Foundry)

```bash
yarn test:contracts
```

### Só frontend (Vitest)

```bash
yarn test:frontend
```

### Cobertura dos contratos

```bash
yarn coverage
```

Gera relatório em `coverage/`. Para relatório HTML:

```bash
yarn coverage:report
```

---

## Testes E2E (interface + contratos reais)

Os testes E2E exigem Anvil rodando e o frontend no ar.

**Pré-requisito:** Inicie o ambiente local antes ([docs/execucao.md](execucao.md), Opção A).

### Rodar todos os testes E2E

```bash
# Terminal 3 (com Anvil + frontend já rodando)
cd ~/projetos/projeto_final
yarn test:e2e
```

### Opções de visualização

```bash
yarn test:e2e:headed   # abre o navegador durante os testes
yarn test:e2e:ui       # interface visual do Playwright (acompanhar em tempo real)
```

### Filtros por suíte

```bash
yarn test:e2e --grep "T-GOV"      # Governança (propostas + votação)
yarn test:e2e --grep "T-PEDIDO"   # Ciclo de compra completo
yarn test:e2e --grep "T-DISPUTA"  # Abertura e resolução de disputas
yarn test:e2e --grep "T-GESTAO"   # Gestão institucional
```

---

## O que os testes cobrem

### Contratos (Foundry)

- Caminho feliz de cada fluxo
- Permissões por ator (quem pode chamar o quê)
- Custom errors tipados
- Eventos emitidos
- Bloqueio e isolamento de saldo entre projetos
- Rejeição de fornecedor fora da whitelist
- Rejeição de Proof of Impact vazio (`bytes32(0)`)
- Disputa antes e após confirmação do fornecedor
- Execução automática após quórum
- Votação quadrática (`sqrt(valor_total_doado)`)
- Remoção de instituição em O(1)
- Proteção contra reentrância

### Frontend E2E (Playwright): 59 testes

Os testes E2E cobrem os fluxos completos de cada ator:

| Suíte | Descrição |
|---|---|
| `T-GOV` | Abertura de proposta, votação, execução automática, quórum |
| `T-PEDIDO` | Criar pedido, confirmar entrega, submeter Proof of Impact, pagamento |
| `T-DISPUTA` | Abrir disputa, submeter evidências, votar, executar veredicto |
| `T-GESTAO` | Bootstrap, pausa, despausa, remoção de instituição |

---

[← Como rodar o projeto localmente ou na Sepolia](execucao.md) | [Onde foi usado IA no desenvolvimento →](ia.md)
