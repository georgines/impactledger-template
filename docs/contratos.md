# Contratos na Testnet Sepolia

[Início](../README.md)

---

Os quatro contratos estão publicados na rede de testes Ethereum Sepolia. Qualquer pessoa pode verificar o código, os eventos e o saldo diretamente no Etherscan, sem precisar de conta ou carteira.

## Endereços

| Contrato | Endereço | Etherscan |
|---|---|---|
| **GovernanceDAO** | `0x265006aDc8fE15DD782fDcC66ae38C54e120A930` | [Ver na Sepolia](https://sepolia.etherscan.io/address/0x265006aDc8fE15DD782fDcC66ae38C54e120A930) |
| **InstitutionRegistry** | `0x60a12179CC39b096C9C575512c340C1434C366a5` | [Ver na Sepolia](https://sepolia.etherscan.io/address/0x60a12179CC39b096C9C575512c340C1434C366a5) |
| **Treasury** | `0xCA6c062CBa0Bad79E3f333d103a30A1021965082` | [Ver na Sepolia](https://sepolia.etherscan.io/address/0xCA6c062CBa0Bad79E3f333d103a30A1021965082) |
| **PurchaseManager** | `0x18d46dd9979f51Efb7CbEd2D1ba52C8a07Bc362a` | [Ver na Sepolia](https://sepolia.etherscan.io/address/0x18d46dd9979f51Efb7CbEd2D1ba52C8a07Bc362a) |

---

## O que cada um faz

**GovernanceDAO**: registra propostas e acumula votos com peso quadrático (`√total_doado`). Quando o quórum é atingido, qualquer participante pode acionar a execução.

**InstitutionRegistry**: guarda a lista de instituições aprovadas e o status de cada uma (ativa, pausada, removida). É onde o frontend consulta para identificar o papel do endereço conectado.

**Treasury**: cuida do dinheiro. Recebe as doações, mantém o saldo de cada instituição separado dos demais e só libera pagamento depois que a Prova de Impacto é validada.

**PurchaseManager**: gerencia o ciclo de pedidos do início ao fim: abertura, entrega, confirmação, pagamento. Também resolve disputas e registra os hashes das evidências no IPFS.

---

## Como verificar no Etherscan

Clique em qualquer link da tabela acima e abra:

- Aba **Contract**: código-fonte verificado e publicado
- Aba **Events**: histórico de doações, votos, pagamentos e disputas
- Aba **Read Contract**: consulte qualquer função sem precisar de carteira

---

## ETH de teste

Para interagir com os contratos na Sepolia você precisa de ETH de teste. É gratuito:

- [sepoliafaucet.com](https://sepoliafaucet.com) (requer conta GitHub ou Alchemy)
- [faucet.sepolia.dev](https://faucet.sepolia.dev) (alternativa pública)

---

## Endereços locais (Anvil)

Quando o projeto roda localmente, os contratos são publicados no Anvil com endereços fixos:

| Contrato | Endereço |
|---|---|
| GovernanceDAO | `0x5FbDB2315678afecb367f032d93F642f64180aa3` |
| InstitutionRegistry | `0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512` |
| Treasury | `0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0` |
| PurchaseManager | `0xCf7Ed3AccA5a467e9e704C703E8D87F634fB0Fc9` |

---

[← Todos os fluxos da plataforma por ator](funcionamento.md) | [Capturas de tela do fluxo principal →](demo/screenshots.md)
