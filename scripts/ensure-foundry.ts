import { spawnSync } from 'child_process'
import fs from 'fs'
import os from 'os'
import path from 'path'

export const FOUNDRY_BIN = path.join(os.homedir(), '.foundry', 'bin')
export const FORGE_BIN = path.join(FOUNDRY_BIN, 'forge')

// Verifica se forge está disponível no PATH do sistema.
export function isForgeInPath(): boolean {
  const result = spawnSync('forge', ['--version'], { encoding: 'utf8' })
  return result.status === 0
}

// Verifica se o binário forge existe no diretório de instalação padrão do Foundry.
export function isForgeInstalled(): boolean {
  return fs.existsSync(FORGE_BIN)
}

// Retorna a versão do forge instalado.
export function getForgeVersion(): string {
  const result = spawnSync('forge', ['--version'], { encoding: 'utf8' })
  return result.stdout.trim().split('\n')[0]
}

// Baixa e executa o instalador do Foundry via curl e foundryup.
export function installFoundry(): void {
  const installer = downloadFoundryInstaller()
  runBashInstaller(installer)
  runFoundryup()
}

// Garante que o Foundry está instalado; instala automaticamente se não encontrado.
export function ensureFoundry(): void {
  if (isForgeInPath()) {
    console.log(`foundry: ${getForgeVersion()}`)
    return
  }

  if (isForgeInstalled()) {
    reportFoundryOutOfPath()
    return
  }

  console.log('foundry: forge não encontrado — instalando...')
  installFoundry()
  console.log('foundry: instalação concluída')
  console.log('  Execute: source ~/.bashrc  (ou abra um novo terminal)')
}

// Baixa o script de instalação do Foundry via curl e retorna seu conteúdo.
function downloadFoundryInstaller(): string {
  const result = spawnSync('curl', ['-L', 'https://foundry.paradigm.xyz'], { encoding: 'utf8' })

  if (result.status !== 0) {
    throw new Error(`Falha ao baixar o instalador do Foundry:\n${result.stderr}`)
  }

  return result.stdout
}

// Executa o script bash de instalação do Foundry via stdin.
function runBashInstaller(installerScript: string): void {
  spawnSync('bash', [], {
    input: installerScript,
    stdio: ['pipe', 'inherit', 'inherit'],
    env: { ...process.env, PATH: `${FOUNDRY_BIN}:${process.env.PATH}` },
  })
}

// Executa foundryup para instalar as ferramentas do Foundry.
function runFoundryup(): void {
  const result = spawnSync(path.join(FOUNDRY_BIN, 'foundryup'), [], {
    stdio: 'inherit',
    env: { ...process.env, PATH: `${FOUNDRY_BIN}:${process.env.PATH}` },
  })

  if (result.status !== 0) {
    throw new Error('foundryup falhou')
  }
}

// Exibe instrução para adicionar o diretório do Foundry ao PATH.
function reportFoundryOutOfPath(): void {
  console.log(`foundry: forge encontrado em ${FOUNDRY_BIN} mas fora do PATH`)
  console.log(`  Execute: export PATH="$HOME/.foundry/bin:$PATH"`)
  console.log(`  Ou abra um novo terminal após: source ~/.bashrc`)
}

if (require.main === module) {
  ensureFoundry()
}
