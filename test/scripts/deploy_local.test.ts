import fs from 'fs'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const { mockDeploy, mockWaitForDeployment, mockGetAddress } = vi.hoisted(() => ({
  mockDeploy: vi.fn(),
  mockWaitForDeployment: vi.fn(),
  mockGetAddress: vi.fn(),
}))

vi.mock('fs', async (importOriginal) => {
  const actual = await importOriginal<typeof import('fs')>()
  return {
    default: {
      ...actual,
      existsSync: vi.fn(),
      readFileSync: vi.fn(),
      mkdirSync: vi.fn(),
      writeFileSync: vi.fn(),
    },
  }
})

vi.mock('ethers', async (importOriginal) => {
  const actual = await importOriginal<typeof import('ethers')>()
  return {
    ...actual,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ContractFactory: vi.fn().mockImplementation(function (this: any) {
      this.deploy = mockDeploy
    }),
  }
})

import {
  checkNodeConnection,
  deployAllContracts,
  deployContract,
  loadArtifact,
  preCalculateAddresses,
  saveDeployOutput,
  verifyAddresses,
} from '../../scripts/deploy_local'

const SAMPLE_CONFIG = {
  minQuorum:          1n,
  votingPeriod:       120n,
  disputeWindow:      120n,
  confirmationWindow: 120n,
}

const SAMPLE_ARTIFACT = { abi: [{ type: 'function', name: 'test' }], bytecode: { object: '0x1234' } }

const SAMPLE_ADDRESSES = {
  GovernanceDAO: '0xAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
  InstitutionRegistry: '0xBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB',
  Treasury: '0xCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCC',
  PurchaseManager: '0xDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDD',
}

const SAMPLE_ARTIFACTS = {
  GovernanceDAO: { abi: [], bytecode: '0x' },
  InstitutionRegistry: { abi: [], bytecode: '0x' },
  Treasury: { abi: [], bytecode: '0x' },
  PurchaseManager: { abi: [], bytecode: '0x' },
}

describe('loadArtifact', () => {
  beforeEach(() => vi.clearAllMocks())

  it('lança erro com mensagem clara quando artefato não existe', () => {
    vi.mocked(fs.existsSync).mockReturnValue(false)

    expect(() => loadArtifact('Treasury')).toThrow('Artefato não encontrado')
  })

  it('instrui a executar yarn compile quando artefato não existe', () => {
    vi.mocked(fs.existsSync).mockReturnValue(false)

    expect(() => loadArtifact('Treasury')).toThrow('yarn compile')
  })

  it('retorna abi e bytecode do artefato compilado', () => {
    vi.mocked(fs.existsSync).mockReturnValue(true)
    ;(vi.mocked(fs.readFileSync) as ReturnType<typeof vi.fn>).mockReturnValue(
      JSON.stringify(SAMPLE_ARTIFACT),
    )

    const result = loadArtifact('Treasury')

    expect(result.abi).toEqual(SAMPLE_ARTIFACT.abi)
    expect(result.bytecode).toBe('0x1234')
  })
})

describe('preCalculateAddresses', () => {
  const DEPLOYER = '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266'

  it('retorna endereços para os quatro contratos', () => {
    const result = preCalculateAddresses(DEPLOYER, 0)

    expect(result).toHaveProperty('GovernanceDAO')
    expect(result).toHaveProperty('InstitutionRegistry')
    expect(result).toHaveProperty('Treasury')
    expect(result).toHaveProperty('PurchaseManager')
  })

  it('cada endereço tem formato de endereço Ethereum válido', () => {
    const result = preCalculateAddresses(DEPLOYER, 0)

    for (const addr of Object.values(result)) {
      expect(addr).toMatch(/^0x[0-9a-fA-F]{40}$/)
    }
  })

  it('endereços são determinísticos para o mesmo deployer e nonce', () => {
    const first = preCalculateAddresses(DEPLOYER, 5)
    const second = preCalculateAddresses(DEPLOYER, 5)

    expect(first).toEqual(second)
  })

  it('endereços diferem quando nonce inicial difere', () => {
    const atNonce0 = preCalculateAddresses(DEPLOYER, 0)
    const atNonce10 = preCalculateAddresses(DEPLOYER, 10)

    expect(atNonce0.GovernanceDAO).not.toBe(atNonce10.GovernanceDAO)
  })
})

describe('verifyAddresses', () => {
  it('não lança erro quando todos os endereços coincidem', () => {
    expect(() => verifyAddresses(SAMPLE_ADDRESSES, { ...SAMPLE_ADDRESSES })).not.toThrow()
  })

  it('não lança erro quando endereços diferem apenas por capitalização', () => {
    const lower = {
      GovernanceDAO: SAMPLE_ADDRESSES.GovernanceDAO.toLowerCase(),
      InstitutionRegistry: SAMPLE_ADDRESSES.InstitutionRegistry.toLowerCase(),
      Treasury: SAMPLE_ADDRESSES.Treasury.toLowerCase(),
      PurchaseManager: SAMPLE_ADDRESSES.PurchaseManager.toLowerCase(),
    }

    expect(() => verifyAddresses(SAMPLE_ADDRESSES, lower)).not.toThrow()
  })

  it('lança erro com mensagem clara quando endereço não coincide', () => {
    const mismatched = { ...SAMPLE_ADDRESSES, Treasury: '0xWRONG' + '0'.repeat(35) }

    expect(() => verifyAddresses(SAMPLE_ADDRESSES, mismatched)).toThrow(
      'não coincidem com os pré-calculados',
    )
  })

  it('menciona transações pendentes na mensagem de erro', () => {
    const mismatched = { ...SAMPLE_ADDRESSES, GovernanceDAO: '0xWRONG' + '0'.repeat(34) }

    expect(() => verifyAddresses(SAMPLE_ADDRESSES, mismatched)).toThrow('transações pendentes')
  })
})

describe('saveDeployOutput', () => {
  let consoleSpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    vi.clearAllMocks()
    consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
  })

  afterEach(() => consoleSpy.mockRestore())

  it('cria o diretório de saída antes de gravar', () => {
    saveDeployOutput('0xDeployer', SAMPLE_ADDRESSES)

    expect(vi.mocked(fs.mkdirSync)).toHaveBeenCalled()
  })

  it('grava JSON com campo network igual a localhost', () => {
    saveDeployOutput('0xDeployer', SAMPLE_ADDRESSES)

    const [, content] = vi.mocked(fs.writeFileSync).mock.calls[0]
    const output = JSON.parse(content as string)

    expect(output.network).toBe('localhost')
  })

  it('grava deployer e contratos no JSON de saída', () => {
    saveDeployOutput('0xDeployer', SAMPLE_ADDRESSES)

    const [, content] = vi.mocked(fs.writeFileSync).mock.calls[0]
    const output = JSON.parse(content as string)

    expect(output.deployer).toBe('0xDeployer')
    expect(output.contracts).toEqual(SAMPLE_ADDRESSES)
  })

  it('inclui timestamp de deploy no JSON de saída', () => {
    saveDeployOutput('0xDeployer', SAMPLE_ADDRESSES)

    const [, content] = vi.mocked(fs.writeFileSync).mock.calls[0]
    const output = JSON.parse(content as string)

    expect(output.deployedAt).toBeDefined()
    expect(() => new Date(output.deployedAt)).not.toThrow()
  })
})

describe('checkNodeConnection', () => {
  it('não lança erro quando nó responde normalmente', async () => {
    const provider = { getBlockNumber: vi.fn().mockResolvedValue(1) } as any

    await expect(checkNodeConnection(provider, 'http://localhost:8545')).resolves.toBeUndefined()
  })

  it('lança erro com mensagem clara quando conexão falha', async () => {
    const provider = {
      getBlockNumber: vi.fn().mockRejectedValue(new Error('ECONNREFUSED')),
    } as any

    await expect(checkNodeConnection(provider, 'http://localhost:8545')).rejects.toThrow(
      'Não foi possível conectar',
    )
  })

  it('instrui a iniciar o nó quando conexão falha', async () => {
    const provider = {
      getBlockNumber: vi.fn().mockRejectedValue(new Error('ECONNREFUSED')),
    } as any

    await expect(checkNodeConnection(provider, 'http://localhost:8545')).rejects.toThrow('Inicie o nó')
  })
})

describe('deployContract', () => {
  it('chama deploy com os argumentos e nonce corretos', async () => {
    const mockContract = { waitForDeployment: vi.fn().mockResolvedValue(undefined) }
    const mockFactory = { deploy: vi.fn().mockResolvedValue(mockContract) } as any

    await deployContract(mockFactory, ['0xARG1', '0xARG2'], 5)

    expect(mockFactory.deploy).toHaveBeenCalledWith('0xARG1', '0xARG2', { nonce: 5 })
  })

  it('aguarda confirmação do deploy antes de retornar', async () => {
    const mockContract = { waitForDeployment: vi.fn().mockResolvedValue(undefined) }
    const mockFactory = { deploy: vi.fn().mockResolvedValue(mockContract) } as any

    await deployContract(mockFactory, [], 0)

    expect(mockContract.waitForDeployment).toHaveBeenCalled()
  })

  it('retorna o contrato deployado', async () => {
    const mockContract = { waitForDeployment: vi.fn().mockResolvedValue(undefined) }
    const mockFactory = { deploy: vi.fn().mockResolvedValue(mockContract) } as any

    const result = await deployContract(mockFactory, [], 0)

    expect(result).toBe(mockContract)
  })
})

describe('deployAllContracts', () => {
  const mockWallet = { address: '0xOPERATOR' } as any

  let consoleSpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    vi.clearAllMocks()
    consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {})

    const mockContract = {
      waitForDeployment: mockWaitForDeployment,
      getAddress: mockGetAddress,
    }
    mockDeploy.mockResolvedValue(mockContract)
    mockWaitForDeployment.mockResolvedValue(undefined)
    mockGetAddress
      .mockResolvedValueOnce(SAMPLE_ADDRESSES.GovernanceDAO)
      .mockResolvedValueOnce(SAMPLE_ADDRESSES.InstitutionRegistry)
      .mockResolvedValueOnce(SAMPLE_ADDRESSES.Treasury)
      .mockResolvedValueOnce(SAMPLE_ADDRESSES.PurchaseManager)
  })

  afterEach(() => consoleSpy.mockRestore())

  it('deploya os quatro contratos e retorna os endereços corretos', async () => {
    const result = await deployAllContracts(mockWallet, SAMPLE_ARTIFACTS, SAMPLE_ADDRESSES, 0, SAMPLE_CONFIG)

    expect(result).toEqual(SAMPLE_ADDRESSES)
    expect(mockDeploy).toHaveBeenCalledTimes(4)
  })

  it('passa o endereço do deployer como operador no GovernanceDAO', async () => {
    await deployAllContracts(mockWallet, SAMPLE_ARTIFACTS, SAMPLE_ADDRESSES, 0, SAMPLE_CONFIG)

    const firstCallArgs = mockDeploy.mock.calls[0]
    expect(firstCallArgs[0]).toBe('0xOPERATOR')
  })

  it('usa nonce sequencial a partir do startNonce para cada contrato', async () => {
    await deployAllContracts(mockWallet, SAMPLE_ARTIFACTS, SAMPLE_ADDRESSES, 3, SAMPLE_CONFIG)

    const nonces = mockDeploy.mock.calls.map((call) => call[call.length - 1].nonce)
    expect(nonces).toEqual([3, 4, 5, 6])
  })

  it('passa minQuorum como último argumento antes do nonce no GovernanceDAO', async () => {
    await deployAllContracts(mockWallet, SAMPLE_ARTIFACTS, SAMPLE_ADDRESSES, 0, SAMPLE_CONFIG)

    const governanceArgs = mockDeploy.mock.calls[0]
    // args: operator, institutionRegistry, purchaseManager, treasury, minQuorum, { nonce }
    const minQuorumArg = governanceArgs[governanceArgs.length - 2]
    expect(typeof minQuorumArg).toBe('bigint')
  })
})
