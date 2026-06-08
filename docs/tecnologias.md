# Tecnologias Utilizadas

[Início](../README.md)

---


## Contratos inteligentes

| Tecnologia | Versão | Para que serve |
|---|---|---|
| Solidity | 0.8.24 | Linguagem dos contratos inteligentes |
| OpenZeppelin | 5.0.0 | Biblioteca de padrões de segurança para Solidity |
| Foundry | latest | Compilação, testes e deploy dos contratos |
| Ethereum Sepolia | N/A | Rede de testes pública onde os contratos estão deployados |

---

## Frontend

| Tecnologia | Versão | Para que serve |
|---|---|---|
| Next.js | 16.2.6 | Framework React com roteamento e build otimizado |
| React | 19.0.0 | Biblioteca de interface de usuário |
| TypeScript | 6.0.3 | Tipagem estática para JavaScript |
| ethers.js | 6.0.0 | Comunicação com a blockchain Ethereum |
| Mantine UI | 9.2.1 | Componentes visuais (formulários, modais, layout) |
| Zod | 4.4.3 | Validação de formulários e dados |
| Tabler Icons | 3.44.0 | Ícones da interface |

---

## Armazenamento descentralizado

| Tecnologia | Versão | Para que serve |
|---|---|---|
| IPFS via Pinata | N/A | Armazenamento permanente de Provas de Impacto e evidências de disputa |

Os arquivos enviados ao IPFS recebem um hash (`CID`) único. Esse hash é registrado on-chain como `bytes32`. Qualquer pessoa pode acessar o arquivo pelo hash; ele não pode ser removido ou alterado.

---

## Testes

| Tecnologia | Versão | Para que serve |
|---|---|---|
| Foundry (forge test) | latest | Testes dos contratos Solidity |
| Vitest | 4.1.7 | Testes unitários do frontend |
| Playwright | 1.60.0 | Testes E2E de interface (59 testes automatizados) |

---

## Infraestrutura e ferramentas

| Tecnologia | Para que serve |
|---|---|
| Anvil (Foundry) | Blockchain local para desenvolvimento e testes E2E |
| MetaMask | Carteira Web3 do usuário (extensão de navegador) |
| Node.js 20 | Ambiente de execução JavaScript |
| Yarn | Gerenciador de pacotes |
| WSL Ubuntu | Ambiente Linux no Windows (necessário para Foundry) |

---

[← Como as peças se conectam por dentro](arquitetura.md) | [Todos os fluxos da plataforma por ator →](funcionamento.md)
