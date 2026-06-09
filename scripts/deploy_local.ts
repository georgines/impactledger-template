/**
 * Deploy do EloSolidário na blockchain local do Foundry (Anvil).
 *
 * Os quatro contratos têm dependência circular de endereços nos construtores.
 * Pré-calculamos os endereços com ethers.getCreateAddress() antes de qualquer
 * deploy para que cada contrato receba os endereços corretos.
 *
 * Ordem de deploy (por nonce):
 *   +0 GovernanceDAO · +1 InstitutionRegistry · +2 Treasury · +3 PurchaseManager
 */

import { ethers } from 'ethers'
import fs from 'fs'
import path from 'path'
import {
  type DeployedAddresses,
  checkNodeConnection,
  createConfigFromEnv,
  deployAllContracts,
  loadAllArtifacts,
  preCalculateAddresses,
  verifyAddresses,
} from './deploy_helpers'

export * from './deploy_helpers'

const ANVIL_PRIVATE_KEY = '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80'
const RPC_URL = process.env.URL_RPC ?? 'http://127.0.0.1:8545'

export const OUT_PATH = path.resolve(__dirname, '..', 'frontend', 'src', 'deploy', 'local.json')

// Salva o resultado do deploy local em JSON no diretório de deploy do frontend.
export function saveDeployOutput(deployer: string, addresses: DeployedAddresses): void {
  const output = {
    network: 'localhost',
    deployedAt: new Date().toISOString(),
    deployer,
    contracts: addresses,
  }

  fs.mkdirSync(path.dirname(OUT_PATH), { recursive: true })
  fs.writeFileSync(OUT_PATH, JSON.stringify(output, null, 2))
  console.log('\nSaída salva em:', OUT_PATH)
}

// Orquestra o deploy completo na rede local Anvil com endereços pré-calculados.
export async function main(): Promise<void> {
  const provider = new ethers.JsonRpcProvider(RPC_URL)
  await checkNodeConnection(provider, RPC_URL)

  const wallet = new ethers.Wallet(ANVIL_PRIVATE_KEY, provider)
  const deployer = wallet.address
  const startNonce = await provider.getTransactionCount(deployer)

  console.log('=== EloSolidário — Deploy local ===')
  console.log('RPC URL  :', RPC_URL)
  console.log('Deployer :', deployer)

  const addresses = preCalculateAddresses(deployer, startNonce)

  console.log('\nEndereços pré-calculados:')
  console.log('  GovernanceDAO      :', addresses.GovernanceDAO)
  console.log('  InstitutionRegistry:', addresses.InstitutionRegistry)
  console.log('  Treasury           :', addresses.Treasury)
  console.log('  PurchaseManager    :', addresses.PurchaseManager)
  console.log('')

  const config = createConfigFromEnv()

  const artifacts = loadAllArtifacts()
  const deployed = await deployAllContracts(wallet, artifacts, addresses, startNonce, config)
  verifyAddresses(addresses, deployed)

  console.log('\n=== Deploy concluído ===')
  console.log('GovernanceDAO      :', deployed.GovernanceDAO)
  console.log('InstitutionRegistry:', deployed.InstitutionRegistry)
  console.log('Treasury           :', deployed.Treasury)
  console.log('PurchaseManager    :', deployed.PurchaseManager)

  saveDeployOutput(deployer, deployed)
}

if (require.main === module) {
  main().catch((err) => {
    console.error('\nErro no deploy:', err.message ?? err)
    process.exit(1)
  })
}
