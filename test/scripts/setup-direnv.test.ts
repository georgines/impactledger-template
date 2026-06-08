import { spawnSync } from 'child_process'
import fs from 'fs'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('child_process', () => ({ spawnSync: vi.fn() }))
vi.mock('fs', async (importOriginal) => {
  const actual = await importOriginal<typeof import('fs')>()
  return {
    default: {
      ...actual,
      existsSync: vi.fn(),
      readFileSync: vi.fn(),
      appendFileSync: vi.fn(),
      writeFileSync: vi.fn(),
    },
  }
})

const mockSpawnSync = vi.mocked(spawnSync)

function mockDirenvInstalled(version = '2.35.0') {
  mockSpawnSync.mockReturnValue({ status: 0, stdout: `${version}\n` } as ReturnType<typeof spawnSync>)
}

function mockDirenvNotInstalled() {
  mockSpawnSync.mockReturnValue({ status: 1, stdout: '', stderr: '' } as ReturnType<typeof spawnSync>)
}

async function loadModule() {
  vi.resetModules()
  return import('../../scripts/setup-direnv')
}

describe('isDirenvInstalled', () => {
  beforeEach(() => vi.clearAllMocks())

  it('retorna true quando direnv está disponível no PATH', async () => {
    mockDirenvInstalled()
    const { isDirenvInstalled } = await loadModule()

    expect(isDirenvInstalled()).toBe(true)
  })

  it('retorna false quando direnv não está no PATH', async () => {
    mockDirenvNotInstalled()
    const { isDirenvInstalled } = await loadModule()

    expect(isDirenvInstalled()).toBe(false)
  })

  it('retorna false quando status é null', async () => {
    mockSpawnSync.mockReturnValue({ status: null, stdout: '' } as ReturnType<typeof spawnSync>)
    const { isDirenvInstalled } = await loadModule()

    expect(isDirenvInstalled()).toBe(false)
  })
})

describe('getDirenvVersion', () => {
  beforeEach(() => vi.clearAllMocks())

  it('retorna versão sem espaços extras', async () => {
    mockDirenvInstalled('2.35.0')
    const { getDirenvVersion } = await loadModule()

    expect(getDirenvVersion()).toBe('2.35.0')
  })
})

describe('hasHookInBashrc', () => {
  beforeEach(() => vi.clearAllMocks())

  it('retorna false quando .bashrc não existe', async () => {
    vi.mocked(fs.existsSync).mockReturnValue(false)
    const { hasHookInBashrc } = await loadModule()

    expect(hasHookInBashrc('/home/user/.bashrc')).toBe(false)
  })

  it('retorna true quando hook já está no .bashrc', async () => {
    vi.mocked(fs.existsSync).mockReturnValue(true)
    vi.mocked(fs.readFileSync).mockReturnValue('eval "$(direnv hook bash)"\n' as unknown as Buffer)
    const { hasHookInBashrc } = await loadModule()

    expect(hasHookInBashrc('/home/user/.bashrc')).toBe(true)
  })

  it('retorna false quando .bashrc existe mas não tem hook', async () => {
    vi.mocked(fs.existsSync).mockReturnValue(true)
    vi.mocked(fs.readFileSync).mockReturnValue('export PATH="$HOME/bin:$PATH"\n' as unknown as Buffer)
    const { hasHookInBashrc } = await loadModule()

    expect(hasHookInBashrc('/home/user/.bashrc')).toBe(false)
  })
})

describe('addHookToBashrc', () => {
  beforeEach(() => vi.clearAllMocks())

  it('chama appendFileSync com hook line', async () => {
    const { addHookToBashrc, HOOK_LINE } = await loadModule()

    addHookToBashrc('/home/user/.bashrc')

    expect(vi.mocked(fs.appendFileSync)).toHaveBeenCalledWith(
      '/home/user/.bashrc',
      expect.stringContaining(HOOK_LINE),
      'utf8'
    )
  })
})

describe('hasEnvrc', () => {
  beforeEach(() => vi.clearAllMocks())

  it('retorna true quando .envrc existe', async () => {
    vi.mocked(fs.existsSync).mockReturnValue(true)
    const { hasEnvrc } = await loadModule()

    expect(hasEnvrc('/projeto')).toBe(true)
  })

  it('retorna false quando .envrc não existe', async () => {
    vi.mocked(fs.existsSync).mockReturnValue(false)
    const { hasEnvrc } = await loadModule()

    expect(hasEnvrc('/projeto')).toBe(false)
  })
})

describe('createEnvrc', () => {
  beforeEach(() => vi.clearAllMocks())

  it('escreve "dotenv" no .envrc do projeto', async () => {
    const { createEnvrc } = await loadModule()

    createEnvrc('/projeto')

    expect(vi.mocked(fs.writeFileSync)).toHaveBeenCalledWith(
      '/projeto/.envrc',
      'dotenv\n',
      'utf8'
    )
  })
})

describe('installDirenv', () => {
  beforeEach(() => vi.clearAllMocks())

  it('executa apt-get install -y direnv', async () => {
    mockSpawnSync.mockReturnValue({ status: 0 } as ReturnType<typeof spawnSync>)
    const { installDirenv } = await loadModule()

    installDirenv()

    expect(mockSpawnSync).toHaveBeenCalledWith(
      'sudo',
      ['apt-get', 'install', '-y', 'direnv'],
      expect.objectContaining({ stdio: 'inherit' })
    )
  })

  it('lança erro quando apt-get falha', async () => {
    mockSpawnSync.mockReturnValue({ status: 1 } as ReturnType<typeof spawnSync>)
    const { installDirenv } = await loadModule()

    expect(() => installDirenv()).toThrow('Falha ao instalar direnv')
  })
})

describe('runDirenvAllow', () => {
  beforeEach(() => vi.clearAllMocks())

  it('executa direnv allow no diretório do projeto', async () => {
    mockSpawnSync.mockReturnValue({ status: 0 } as ReturnType<typeof spawnSync>)
    const { runDirenvAllow } = await loadModule()

    runDirenvAllow('/meu/projeto')

    expect(mockSpawnSync).toHaveBeenCalledWith(
      'direnv',
      ['allow', '/meu/projeto'],
      expect.objectContaining({ encoding: 'utf8' })
    )
  })

  it('lança erro quando direnv allow falha', async () => {
    mockSpawnSync.mockReturnValue({ status: 1 } as ReturnType<typeof spawnSync>)
    const { runDirenvAllow } = await loadModule()

    expect(() => runDirenvAllow('/meu/projeto')).toThrow('direnv allow falhou')
  })
})

describe('setupDirenv', () => {
  let consoleSpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    vi.clearAllMocks()
    consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
  })

  afterEach(() => consoleSpy.mockRestore())

  it('exibe versão quando direnv já está instalado', async () => {
    mockSpawnSync
      .mockReturnValueOnce({ status: 0, stdout: '2.35.0\n' } as ReturnType<typeof spawnSync>) // isDirenvInstalled
      .mockReturnValueOnce({ status: 0, stdout: '2.35.0\n' } as ReturnType<typeof spawnSync>) // getDirenvVersion
      .mockReturnValue({ status: 0, stdout: '' } as ReturnType<typeof spawnSync>)             // runDirenvAllow
    vi.mocked(fs.existsSync).mockReturnValue(true)
    vi.mocked(fs.readFileSync).mockReturnValue('eval "$(direnv hook bash)"\n' as unknown as Buffer)
    const { setupDirenv } = await loadModule()

    setupDirenv('/tmp/.bashrc', '/tmp/projeto')

    expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('2.35.0'))
  })

  it('instala direnv quando não está disponível', async () => {
    mockSpawnSync
      .mockReturnValueOnce({ status: 1, stdout: '' } as ReturnType<typeof spawnSync>)  // isDirenvInstalled → false
      .mockReturnValueOnce({ status: 0 } as ReturnType<typeof spawnSync>)              // installDirenv → ok
      .mockReturnValue({ status: 0, stdout: '' } as ReturnType<typeof spawnSync>)      // runDirenvAllow
    vi.mocked(fs.existsSync).mockReturnValue(true)
    vi.mocked(fs.readFileSync).mockReturnValue('eval "$(direnv hook bash)"\n' as unknown as Buffer)
    const { setupDirenv } = await loadModule()

    setupDirenv('/tmp/.bashrc', '/tmp/projeto')

    expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('instalando'))
    expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('concluída'))
  })

  it('adiciona hook quando .bashrc não tem a linha', async () => {
    mockSpawnSync
      .mockReturnValueOnce({ status: 0, stdout: '2.35.0\n' } as ReturnType<typeof spawnSync>)
      .mockReturnValueOnce({ status: 0, stdout: '2.35.0\n' } as ReturnType<typeof spawnSync>)
      .mockReturnValue({ status: 0 } as ReturnType<typeof spawnSync>)
    vi.mocked(fs.existsSync).mockReturnValue(true)
    vi.mocked(fs.readFileSync).mockReturnValue('export PATH="$HOME/bin:$PATH"\n' as unknown as Buffer)
    const { setupDirenv } = await loadModule()

    setupDirenv('/tmp/.bashrc', '/tmp/projeto')

    expect(vi.mocked(fs.appendFileSync)).toHaveBeenCalled()
    expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('hook adicionado'))
  })

  it('cria .envrc quando não existe', async () => {
    mockSpawnSync
      .mockReturnValueOnce({ status: 0, stdout: '2.35.0\n' } as ReturnType<typeof spawnSync>)
      .mockReturnValueOnce({ status: 0, stdout: '2.35.0\n' } as ReturnType<typeof spawnSync>)
      .mockReturnValue({ status: 0 } as ReturnType<typeof spawnSync>)
    vi.mocked(fs.existsSync)
      .mockReturnValueOnce(true)   // hasHookInBashrc → .bashrc existe
      .mockReturnValueOnce(false)  // hasEnvrc → .envrc não existe
    vi.mocked(fs.readFileSync).mockReturnValue('eval "$(direnv hook bash)"\n' as unknown as Buffer)
    const { setupDirenv } = await loadModule()

    setupDirenv('/tmp/.bashrc', '/tmp/projeto')

    expect(vi.mocked(fs.writeFileSync)).toHaveBeenCalledWith('/tmp/projeto/.envrc', 'dotenv\n', 'utf8')
    expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('.envrc criado'))
  })

  it('pula etapas já concluídas quando tudo já está configurado', async () => {
    mockSpawnSync
      .mockReturnValueOnce({ status: 0, stdout: '2.35.0\n' } as ReturnType<typeof spawnSync>)
      .mockReturnValueOnce({ status: 0, stdout: '2.35.0\n' } as ReturnType<typeof spawnSync>)
      .mockReturnValue({ status: 0 } as ReturnType<typeof spawnSync>)
    vi.mocked(fs.existsSync).mockReturnValue(true)
    vi.mocked(fs.readFileSync).mockReturnValue('eval "$(direnv hook bash)"\n' as unknown as Buffer)
    const { setupDirenv } = await loadModule()

    setupDirenv('/tmp/.bashrc', '/tmp/projeto')

    expect(vi.mocked(fs.appendFileSync)).not.toHaveBeenCalled()
    expect(vi.mocked(fs.writeFileSync)).not.toHaveBeenCalled()
    expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('hook já presente'))
    expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('.envrc já existe'))
  })
})
