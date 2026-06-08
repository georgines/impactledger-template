import { spawnSync } from 'child_process'
import fs from 'fs'
import os from 'os'
import path from 'path'

export const FOUNDRY_BIN = path.join(os.homedir(), '.foundry', 'bin')
export const FORGE_BIN = path.join(FOUNDRY_BIN, 'forge')

export function isForgeInPath(): boolean {
  const result = spawnSync('forge', ['--version'], { encoding: 'utf8' })
  return result.status === 0
}

export function isForgeInstalled(): boolean {
  return fs.existsSync(FORGE_BIN)
}

export function getForgeVersion(): string {
  const result = spawnSync('forge', ['--version'], { encoding: 'utf8' })
  return result.stdout.trim().split('\n')[0]
}

export function installFoundry(): void {
  const installer = downloadFoundryInstaller()
  runBashInstaller(installer)
  runFoundryup()
}

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

function downloadFoundryInstaller(): string {
  const result = spawnSync('curl', ['-L', 'https://foundry.paradigm.xyz'], { encoding: 'utf8' })

  if (result.status !== 0) {
    throw new Error(`Falha ao baixar o instalador do Foundry:\n${result.stderr}`)
  }

  return result.stdout
}

function runBashInstaller(installerScript: string): void {
  spawnSync('bash', [], {
    input: installerScript,
    stdio: ['pipe', 'inherit', 'inherit'],
    env: { ...process.env, PATH: `${FOUNDRY_BIN}:${process.env.PATH}` },
  })
}

function runFoundryup(): void {
  const result = spawnSync(path.join(FOUNDRY_BIN, 'foundryup'), [], {
    stdio: 'inherit',
    env: { ...process.env, PATH: `${FOUNDRY_BIN}:${process.env.PATH}` },
  })

  if (result.status !== 0) {
    throw new Error('foundryup falhou')
  }
}

function reportFoundryOutOfPath(): void {
  console.log(`foundry: forge encontrado em ${FOUNDRY_BIN} mas fora do PATH`)
  console.log(`  Execute: export PATH="$HOME/.foundry/bin:$PATH"`)
  console.log(`  Ou abra um novo terminal após: source ~/.bashrc`)
}

if (require.main === module) {
  ensureFoundry()
}
