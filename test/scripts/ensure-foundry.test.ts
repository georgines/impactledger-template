import { spawnSync } from 'child_process'
import fs from 'fs'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('child_process', () => ({ spawnSync: vi.fn() }))
vi.mock('fs', async (importOriginal) => {
  const actual = await importOriginal<typeof import('fs')>()
  return { default: { ...actual, existsSync: vi.fn() } }
})

const mockSpawnSync = vi.mocked(spawnSync)

function mockForgeInPath(version = 'forge Version: 1.7.1\n') {
  mockSpawnSync.mockReturnValue({ status: 0, stdout: version } as ReturnType<typeof spawnSync>)
}

function mockForgeNotInPath() {
  mockSpawnSync.mockReturnValue({ status: 1, stdout: '' } as ReturnType<typeof spawnSync>)
}

function mockForgeInstalled(installed: boolean) {
  vi.mocked(fs.existsSync).mockReturnValue(installed)
}

async function loadModule() {
  vi.resetModules()
  return import('../../scripts/ensure-foundry')
}

describe('isForgeInPath', () => {
  beforeEach(() => vi.clearAllMocks())

  it('retorna true quando forge --version encerra com status 0', async () => {
    mockForgeInPath()
    const { isForgeInPath } = await loadModule()

    expect(isForgeInPath()).toBe(true)
  })

  it('retorna false quando forge não está disponível no PATH', async () => {
    mockForgeNotInPath()
    const { isForgeInPath } = await loadModule()

    expect(isForgeInPath()).toBe(false)
  })

  it('retorna false quando forge existe mas encerra com status null', async () => {
    mockSpawnSync.mockReturnValue({ status: null, stdout: '' } as ReturnType<typeof spawnSync>)
    const { isForgeInPath } = await loadModule()

    expect(isForgeInPath()).toBe(false)
  })
})

describe('isForgeInstalled', () => {
  beforeEach(() => vi.clearAllMocks())

  it('retorna true quando o binário existe em ~/.foundry/bin/forge', async () => {
    mockForgeInstalled(true)
    const { isForgeInstalled } = await loadModule()

    expect(isForgeInstalled()).toBe(true)
  })

  it('retorna false quando o binário não existe em ~/.foundry/bin', async () => {
    mockForgeInstalled(false)
    const { isForgeInstalled } = await loadModule()

    expect(isForgeInstalled()).toBe(false)
  })
})

describe('ensureFoundry', () => {
  let consoleSpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    vi.clearAllMocks()
    consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
  })

  afterEach(() => consoleSpy.mockRestore())

  it('exibe a versão do forge quando ele está no PATH', async () => {
    mockForgeInPath('forge Version: 1.7.1\n')
    const { ensureFoundry } = await loadModule()

    ensureFoundry()

    expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('foundry:'))
  })

  it('orienta sobre PATH quando forge está instalado mas não acessível', async () => {
    mockForgeNotInPath()
    mockForgeInstalled(true)
    const { ensureFoundry } = await loadModule()

    ensureFoundry()

    expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('fora do PATH'))
  })

  it('instala o foundry quando forge não é encontrado em nenhum lugar', async () => {
    mockForgeInstalled(false)
    mockSpawnSync
      .mockReturnValueOnce({ status: 1, stdout: '' } as ReturnType<typeof spawnSync>)   // isForgeInPath → false
      .mockReturnValueOnce({ status: 0, stdout: '#!/usr/bin/env bash' } as ReturnType<typeof spawnSync>) // curl → ok
      .mockReturnValue({ status: 0, stdout: '' } as ReturnType<typeof spawnSync>)       // bash + foundryup → ok
    const { ensureFoundry } = await loadModule()

    ensureFoundry()

    expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('instalando'))
    expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('concluída'))
  })
})

describe('installFoundry', () => {
  beforeEach(() => vi.clearAllMocks())

  it('lança erro com mensagem clara quando o download do instalador falha', async () => {
    mockSpawnSync.mockReturnValue({
      status: 1,
      stdout: '',
      stderr: 'Connection refused',
    } as ReturnType<typeof spawnSync>)
    const { installFoundry } = await loadModule()

    expect(() => installFoundry()).toThrow('Falha ao baixar')
  })
})
