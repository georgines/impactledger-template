# Instruções de Execução

[Início](../README.md)

---


## Local ou Sepolia, qual usar?

| | Opção A: Local (Anvil) | Opção B: Sepolia |
|---|---|---|
| **Para quê** | Desenvolvimento e testes | Demonstrar com contratos reais |
| **ETH necessário** | Não (Anvil gera carteiras com saldo fictício) | Sim (ETH de teste gratuito via faucet) |
| **Velocidade** | Transações instantâneas | Blocos a cada ~12 segundos |
| **Dados persistem** | Não (reinicia com Anvil) | Sim (ficam na blockchain pública) |
| **Acesso externo** | Só localhost | Qualquer pessoa com MetaMask |
| **Configuração extra** | Só Pinata | Pinata + chave de carteira MetaMask |

> Use **Opção A** para rodar e testar o projeto. Use **Opção B** para demonstrar o funcionamento com transações verificáveis no Etherscan.

---

## Pré-requisitos

| Ferramenta | Versão mínima | Como instalar |
|---|---|---|
| WSL Ubuntu | qualquer | `wsl --install -d Ubuntu` no PowerShell como administrador |
| Node.js | 20.x | Ver abaixo |
| Yarn | qualquer | `npm install -g yarn` |
| Foundry | latest | Ver abaixo |
| MetaMask | qualquer | Extensão para Chrome/Firefox |

> Todo o projeto deve ser executado dentro do terminal **Ubuntu (WSL)**, não no PowerShell ou CMD do Windows.

---

### Instalar Node.js 20

```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs
```

### Instalar Foundry

```bash
curl -L https://foundry.paradigm.xyz | bash
```

Feche e reabra o terminal, depois rode:

```bash
foundryup
```

### Instalar dependências do Chrome (para testes E2E)

```bash
sudo apt-get install -y libglib2.0-0 libnss3 libatk1.0-0 libatk-bridge2.0-0 \
  libcups2 libdrm2 libxkbcommon0 libxcomposite1 libxdamage1 libxrandr2 \
  libgbm1 libasound2
```

---

## Opção A: Execução local (recomendada para desenvolvimento)

Usa Anvil como blockchain local. Nenhum ETH real necessário.

### 1. Clonar e instalar

```bash
mkdir -p ~/projetos
cd ~/projetos
git clone https://github.com/georgines/projeto_final.git
cd projeto_final
yarn install
npx playwright install chrome
```

### 2. Configurar o ambiente

```bash
cp .env.example .env
```

Edite o `.env` e preencha as variáveis obrigatórias:

```env
REDE_DEPLOY=local
URL_RPC=http://127.0.0.1:8545
CHAVE_PINATA=cole_aqui_seu_jwt
URL_GATEWAY_PINATA=https://seu_gateway.mypinata.cloud/ipfs
```

> Para obter as credenciais do Pinata: crie conta em [app.pinata.cloud](https://app.pinata.cloud) → API Keys → New Key → copie o JWT.

### 3. Rodar o projeto (2 terminais)

**Terminal 1** (deixe aberto e rodando):

```bash
cd ~/projetos/projeto_final
anvil --block-time 1
```

**Terminal 2** (após o Terminal 1 estar no ar):

```bash
cd ~/projetos/projeto_final
yarn deploy:local && yarn copy-abis
yarn dev:turbo
```

**Acesso:** http://localhost:3000

---

## Opção B: Execução com Sepolia (contratos reais na testnet)

Usa os contratos já deployados na rede de testes pública.

### 1. Configurar o ambiente

```bash
cp .env.example .env
```

Edite o `.env`:

```env
REDE_DEPLOY=sepolia
URL_RPC=https://ethereum-sepolia-rpc.publicnode.com
CHAVE_PINATA=cole_aqui_seu_jwt
URL_GATEWAY_PINATA=https://seu_gateway.mypinata.cloud/ipfs
```

> Use o RPC público `https://ethereum-sepolia-rpc.publicnode.com`. Provedores com plano gratuito limitado (ex: Alchemy Free) restringem `eth_getLogs` e causam erro no Mapa do Bem.

### 2. Obter ETH de teste

Acesse [sepoliafaucet.com](https://sepoliafaucet.com) e solicite ETH de teste para sua carteira MetaMask.

### 3. Iniciar o frontend

```bash
cd ~/projetos/projeto_final
yarn dev:turbo
```

**Acesso:** http://localhost:3000

---

## Variáveis de ambiente

| Variável | Obrigatória | Descrição |
|---|---|---|
| `REDE_DEPLOY` | Sim | `local` ou `sepolia`: define qual arquivo de endereços o frontend usa |
| `URL_RPC` | Sim | URL do nó RPC da rede Ethereum |
| `CHAVE_PINATA` | Sim | JWT do Pinata para upload de arquivos no IPFS |
| `URL_GATEWAY_PINATA` | Sim | URL do gateway Pinata para acesso aos arquivos |
| `QUORUM_MINIMO` | Para deploy | Peso mínimo de votos para aprovar proposta (em wei) |
| `PERIODO_VOTACAO` | Para deploy | Duração da votação em segundos |
| `JANELA_DISPUTA` | Para deploy | Prazo para abrir disputa em segundos |
| `JANELA_CONFIRMACAO` | Para deploy | Prazo para confirmar recebimento em segundos |
| `CHAVE_PRIVADA_DEPLOYER` | Só Sepolia | Chave privada da carteira que paga o deploy |

---

## Problemas comuns

**Erro "Mapa do Bem" ao usar Sepolia**

Causado por limitação do plano gratuito do Alchemy (`eth_getLogs` restrito). Troque `URL_RPC` para `https://ethereum-sepolia-rpc.publicnode.com`.

**MetaMask na rede errada**

Verifique se o MetaMask está conectado à mesma rede configurada no `.env` (`local` → localhost:8545 | `sepolia` → Sepolia).

**Contrato retornando dados vazios (0x)**

Indica que o endereço do contrato não corresponde à rede conectada. Verifique `REDE_DEPLOY` no `.env` e se o Anvil está rodando (para rede local).

---

[← Vídeo de demonstração](demo/video.md) | [Como executar os testes →](testes.md)
