import { spawnSync } from 'child_process'
import fs from 'fs'
import os from 'os'
import path from 'path'

export const HOOK_LINE = 'eval "$(direnv hook bash)"'
export const BASHRC_PATH = path.join(os.homedir(), '.bashrc')
export const PROJECT_ROOT = path.resolve(__dirname, '..')

// Verifica se o direnv está disponível no PATH.
export function isDirenvInstalled(): boolean {
  const result = spawnSync('direnv', ['--version'], { encoding: 'utf8' })
  return result.status === 0
}

// Retorna a versão instalada do direnv.
export function getDirenvVersion(): string {
  const result = spawnSync('direnv', ['--version'], { encoding: 'utf8' })
  return result.stdout.trim()
}

// Verifica se o hook do direnv já está presente no .bashrc.
export function hasHookInBashrc(bashrcPath: string): boolean {
  if (!fs.existsSync(bashrcPath)) return false
  const content = fs.readFileSync(bashrcPath, 'utf8')
  return content.includes(HOOK_LINE)
}

// Adiciona a linha de hook do direnv ao final do .bashrc.
export function addHookToBashrc(bashrcPath: string): void {
  const lines = [
    '',
    '# direnv hook (adicionado por setup-direnv.ts)',
    HOOK_LINE,
    '',
  ].join('\n')
  fs.appendFileSync(bashrcPath, lines, 'utf8')
}

// Verifica se o arquivo .envrc já existe na raiz do projeto.
export function hasEnvrc(projectRoot: string): boolean {
  return fs.existsSync(path.join(projectRoot, '.envrc'))
}

// Cria um arquivo .envrc com a diretiva dotenv na raiz do projeto.
export function createEnvrc(projectRoot: string): void {
  fs.writeFileSync(path.join(projectRoot, '.envrc'), 'dotenv\n', 'utf8')
}

// Instala o direnv via apt-get; lança erro se a instalação falhar.
export function installDirenv(): void {
  const result = spawnSync('sudo', ['apt-get', 'install', '-y', 'direnv'], {
    stdio: 'inherit',
  })
  if (result.status !== 0) {
    throw new Error('Falha ao instalar direnv via apt-get')
  }
}

// Executa direnv allow para autorizar o .envrc do projeto.
export function runDirenvAllow(projectRoot: string): void {
  const result = spawnSync('direnv', ['allow', projectRoot], {
    stdio: 'inherit',
    encoding: 'utf8',
  })
  if (result.status !== 0) {
    throw new Error(`direnv allow falhou em: ${projectRoot}`)
  }
}

// Instala, configura hook e autoriza o direnv para o projeto de forma idempotente.
export function setupDirenv(
  bashrcPath: string = BASHRC_PATH,
  projectRoot: string = PROJECT_ROOT
): void {
  if (isDirenvInstalled()) {
    console.log(`direnv: ${getDirenvVersion()}`)
  } else {
    console.log('direnv: não encontrado — instalando...')
    installDirenv()
    console.log('direnv: instalação concluída')
  }

  if (hasHookInBashrc(bashrcPath)) {
    console.log(`direnv: hook já presente em ${bashrcPath}`)
  } else {
    addHookToBashrc(bashrcPath)
    console.log(`direnv: hook adicionado em ${bashrcPath}`)
  }

  if (hasEnvrc(projectRoot)) {
    console.log(`direnv: .envrc já existe em ${projectRoot}`)
  } else {
    createEnvrc(projectRoot)
    console.log(`direnv: .envrc criado em ${projectRoot}`)
  }

  runDirenvAllow(projectRoot)
  console.log('direnv: pronto! Execute: source ~/.bashrc')
}

if (require.main === module) {
  setupDirenv()
}
