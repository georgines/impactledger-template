import { ethers, ContractFactory } from 'ethers'
import fs from 'fs'
import path from 'path'

export type ContractArtifact = {
  abi: ethers.InterfaceAbi
  bytecode: string
}

export type DeployedAddresses = {
  GovernanceDAO: string
  InstitutionRegistry: string
  Treasury: string
  PurchaseManager: string
}

export type AllArtifacts = {
  GovernanceDAO: ContractArtifact
  InstitutionRegistry: ContractArtifact
  Treasury: ContractArtifact
  PurchaseManager: ContractArtifact
}

export type DeployConfig = {
  minQuorum: bigint
  votingPeriod: bigint
  disputeWindow: bigint
  confirmationWindow: bigint
}

const ENV_CONFIG_FIELDS: Record<keyof DeployConfig, string> = {
  minQuorum:           'QUORUM_MINIMO',
  votingPeriod:        'PERIODO_VOTACAO',
  disputeWindow:       'JANELA_DISPUTA',
  confirmationWindow:  'JANELA_CONFIRMACAO',
}

export function createConfigFromEnv(defaults?: Partial<DeployConfig>): DeployConfig {
  const resolve = (field: keyof DeployConfig): bigint => {
    const envVar = ENV_CONFIG_FIELDS[field]
    const raw = process.env[envVar]

    if (raw !== undefined && raw !== '') {
      try {
        return BigInt(raw)
      } catch {
        throw new Error(`${envVar} deve ser um número inteiro. Recebido: ${raw}`)
      }
    }

    const fallback = defaults?.[field]
    if (fallback !== undefined) return fallback

    throw new Error(`Variável de ambiente obrigatória não definida: ${envVar}`)
  }

  return {
    minQuorum:          resolve('minQuorum'),
    votingPeriod:       resolve('votingPeriod'),
    disputeWindow:      resolve('disputeWindow'),
    confirmationWindow: resolve('confirmationWindow'),
  }
}

export function loadArtifact(contractName: string): ContractArtifact {
  const artifactPath = path.resolve(
    __dirname,
    '..',
    'out',
    `${contractName}.sol`,
    `${contractName}.json`,
  )

  if (!fs.existsSync(artifactPath)) {
    throw new Error(
      `Artefato não encontrado: ${artifactPath}\nExecute 'yarn compile' antes de rodar o deploy.`,
    )
  }

  const raw = JSON.parse(fs.readFileSync(artifactPath, 'utf-8'))
  return { abi: raw.abi, bytecode: raw.bytecode.object }
}

export function loadAllArtifacts(): AllArtifacts {
  return {
    GovernanceDAO: loadArtifact('GovernanceDAO'),
    InstitutionRegistry: loadArtifact('InstitutionRegistry'),
    Treasury: loadArtifact('Treasury'),
    PurchaseManager: loadArtifact('PurchaseManager'),
  }
}

export function preCalculateAddresses(deployer: string, startNonce: number): DeployedAddresses {
  return {
    GovernanceDAO: ethers.getCreateAddress({ from: deployer, nonce: startNonce }),
    InstitutionRegistry: ethers.getCreateAddress({ from: deployer, nonce: startNonce + 1 }),
    Treasury: ethers.getCreateAddress({ from: deployer, nonce: startNonce + 2 }),
    PurchaseManager: ethers.getCreateAddress({ from: deployer, nonce: startNonce + 3 }),
  }
}

export function verifyAddresses(expected: DeployedAddresses, actual: DeployedAddresses): void {
  const keys = Object.keys(expected) as Array<keyof DeployedAddresses>
  const mismatch = keys.find((key) => expected[key].toLowerCase() !== actual[key].toLowerCase())

  if (!mismatch) return

  throw new Error(
    'Endereços deployados não coincidem com os pré-calculados.\n' +
      'Verifique se houve transações pendentes antes do deploy.',
  )
}

export async function deployContract(
  factory: ContractFactory,
  args: unknown[],
  nonce: number,
): Promise<ethers.BaseContract> {
  const contract = await factory.deploy(...args, { nonce })
  await contract.waitForDeployment()
  return contract
}

export async function checkNodeConnection(
  provider: ethers.JsonRpcProvider,
  rpcUrl: string,
): Promise<void> {
  try {
    await provider.getBlockNumber()
  } catch {
    throw new Error(`Não foi possível conectar em ${rpcUrl}.\nInicie o nó antes de rodar o deploy.`)
  }
}

export async function deployAllContracts(
  wallet: ethers.Wallet,
  artifacts: AllArtifacts,
  addresses: DeployedAddresses,
  startNonce: number,
  config: DeployConfig,
): Promise<DeployedAddresses> {
  const operator = wallet.address

  console.log('Deployando GovernanceDAO...')
  const governance = await deployContract(
    new ContractFactory(artifacts.GovernanceDAO.abi, artifacts.GovernanceDAO.bytecode, wallet),
    [operator, addresses.InstitutionRegistry, addresses.PurchaseManager, addresses.Treasury, config.minQuorum, config.votingPeriod],
    startNonce,
  )

  console.log('Deployando InstitutionRegistry...')
  const registry = await deployContract(
    new ContractFactory(
      artifacts.InstitutionRegistry.abi,
      artifacts.InstitutionRegistry.bytecode,
      wallet,
    ),
    [addresses.GovernanceDAO],
    startNonce + 1,
  )

  console.log('Deployando Treasury...')
  const treasury = await deployContract(
    new ContractFactory(artifacts.Treasury.abi, artifacts.Treasury.bytecode, wallet),
    [addresses.GovernanceDAO, addresses.PurchaseManager, addresses.InstitutionRegistry],
    startNonce + 2,
  )

  console.log('Deployando PurchaseManager...')
  const purchaseManager = await deployContract(
    new ContractFactory(
      artifacts.PurchaseManager.abi,
      artifacts.PurchaseManager.bytecode,
      wallet,
    ),
    [addresses.GovernanceDAO, addresses.InstitutionRegistry, addresses.Treasury, config.minQuorum, config.disputeWindow, config.confirmationWindow],
    startNonce + 3,
  )

  return {
    GovernanceDAO: await governance.getAddress(),
    InstitutionRegistry: await registry.getAddress(),
    Treasury: await treasury.getAddress(),
    PurchaseManager: await purchaseManager.getAddress(),
  }
}
