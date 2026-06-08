import fs from 'fs'
import path from 'path'

export const CONTRACTS = [
  'Treasury',
  'GovernanceDAO',
  'InstitutionRegistry',
  'PurchaseManager',
] as const

export type ContractName = (typeof CONTRACTS)[number]

export function copyAbis(outDir: string, abisDir: string): void {
  fs.mkdirSync(abisDir, { recursive: true })

  for (const contractName of CONTRACTS) {
    const artifactPath = resolveArtifactPath(outDir, contractName)
    validateArtifactExists(artifactPath)

    const abi = readAbiFromArtifact(artifactPath)
    writeAbiFile(abisDir, contractName, abi)

    console.log(`✓ ${contractName}.json`)
  }
}

function resolveArtifactPath(outDir: string, contractName: string): string {
  return path.join(outDir, `${contractName}.sol`, `${contractName}.json`)
}

function validateArtifactExists(artifactPath: string): void {
  if (!fs.existsSync(artifactPath)) {
    throw new Error(
      `Artefato não encontrado: ${artifactPath}\nExecute yarn compile antes de yarn copy-abis`,
    )
  }
}

function readAbiFromArtifact(artifactPath: string): unknown[] {
  const artifact = JSON.parse(fs.readFileSync(artifactPath, 'utf8'))
  return artifact.abi
}

function writeAbiFile(abisDir: string, contractName: string, abi: unknown[]): void {
  const destPath = path.join(abisDir, `${contractName}.json`)
  fs.writeFileSync(destPath, JSON.stringify(abi, null, 2) + '\n')
}

if (require.main === module) {
  const ROOT = path.resolve(__dirname, '..')
  copyAbis(
    path.join(ROOT, 'out'),
    path.join(ROOT, 'frontend', 'src', 'abis'),
  )
}
