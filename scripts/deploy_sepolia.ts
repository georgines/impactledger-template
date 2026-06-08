/**
 * Deploy do EloSolidário na Sepolia.
 *
 * Todas as configurações são lidas do arquivo .env (via process.env).
 * Copie .env.example para .env e preencha os valores antes de rodar.
 *
 * Ordem de deploy (por nonce):
 *   +0 GovernanceDAO · +1 InstitutionRegistry · +2 Treasury · +3 PurchaseManager
 */

import { ethers, ContractFactory } from 'ethers'
import fs from 'fs'
import path from 'path'
import {
  type AllArtifacts,
  type DeployedAddresses,
  type DeployConfig,
  createConfigFromEnv,
  loadAllArtifacts,
  preCalculateAddresses,
  deployAllContracts,
  verifyAddresses,
  checkNodeConnection,
} from './deploy_helpers'

const OUT_PATH = path.resolve(__dirname, '..', 'frontend', 'src', 'deploy', 'sepolia.json')

function requireEnv(name: string): string {
  const value = process.env[name]
  if (!value) throw new Error(`Variável de ambiente obrigatória não definida: ${name}`)
  return value
}


function saveDeployOutput(deployer: string, addresses: DeployedAddresses, deployedAtBlock: number): void {
  const output = {
    network: 'sepolia',
    deployedAt: new Date().toISOString(),
    deployedAtBlock,
    deployer,
    contracts: addresses,
  }

  fs.mkdirSync(path.dirname(OUT_PATH), { recursive: true })
  fs.writeFileSync(OUT_PATH, JSON.stringify(output, null, 2))
  console.log('\nSaída salva em:', OUT_PATH)
}

async function main(): Promise<void> {
  const rpcUrl     = requireEnv('URL_RPC')
  const privateKey = requireEnv('CHAVE_PRIVADA_DEPLOYER')

  const config = createConfigFromEnv()

  const provider = new ethers.JsonRpcProvider(rpcUrl)
  await checkNodeConnection(provider, rpcUrl)

  const wallet   = new ethers.Wallet(privateKey, provider)
  const deployer = wallet.address
  const startNonce = await provider.getTransactionCount(deployer)

  console.log('=== EloSolidário — Deploy Sepolia ===')
  console.log('RPC URL              :', rpcUrl)
  console.log('Deployer             :', deployer)
  console.log('Quórum mínimo        :', config.minQuorum.toString(), 'wei')
  console.log('Período de votação   :', config.votingPeriod.toString(), 's')
  console.log('Janela de disputa    :', config.disputeWindow.toString(), 's')
  console.log('Janela de confirmação:', config.confirmationWindow.toString(), 's')

  const balance = await provider.getBalance(deployer)
  console.log('Saldo deployer       :', ethers.formatEther(balance), 'ETH')
  if (balance === 0n) throw new Error('Saldo zero. Obtenha ETH de teste em https://sepoliafaucet.com')

  const addresses = preCalculateAddresses(deployer, startNonce)

  console.log('\nEndereços pré-calculados:')
  console.log('  GovernanceDAO      :', addresses.GovernanceDAO)
  console.log('  InstitutionRegistry:', addresses.InstitutionRegistry)
  console.log('  Treasury           :', addresses.Treasury)
  console.log('  PurchaseManager    :', addresses.PurchaseManager)
  console.log('')

  const artifacts = loadAllArtifacts()
  const deployed  = await deployAllContracts(wallet, artifacts, addresses, startNonce, config)
  verifyAddresses(addresses, deployed)

  const deployedAtBlock = await provider.getBlockNumber()

  console.log('\n=== Deploy concluído ===')
  console.log('GovernanceDAO      :', deployed.GovernanceDAO)
  console.log('InstitutionRegistry:', deployed.InstitutionRegistry)
  console.log('Treasury           :', deployed.Treasury)
  console.log('PurchaseManager    :', deployed.PurchaseManager)
  console.log('Bloco              :', deployedAtBlock)

  saveDeployOutput(deployer, deployed, deployedAtBlock)
}

main().catch((err) => {
  console.error('\nErro no deploy:', err.message ?? err)
  process.exit(1)
})
