import fs from 'fs'
import os from 'os'
import path from 'path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { CONTRACTS, copyAbis } from '../../scripts/copy-abis'

function makeArtifact(abi: unknown[]) {
  return JSON.stringify({ abi, bytecode: '0x', deployedBytecode: '0x' })
}

function sampleAbi() {
  return [{ type: 'function', name: 'test', inputs: [], outputs: [] }]
}

function createFakeArtifacts(outDir: string): void {
  for (const name of CONTRACTS) {
    const contractDir = path.join(outDir, `${name}.sol`)
    fs.mkdirSync(contractDir, { recursive: true })
    fs.writeFileSync(path.join(contractDir, `${name}.json`), makeArtifact(sampleAbi()))
  }
}

describe('copyAbis', () => {
  let tmpDir: string
  let outDir: string
  let abisDir: string

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'copy-abis-test-'))
    outDir = path.join(tmpDir, 'out')
    abisDir = path.join(tmpDir, 'abis')
    createFakeArtifacts(outDir)
  })

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true })
  })

  it('cria o diretório de ABIs se não existir', () => {
    copyAbis(outDir, abisDir)

    expect(fs.existsSync(abisDir)).toBe(true)
  })

  it('gera um arquivo JSON para cada contrato', () => {
    copyAbis(outDir, abisDir)

    for (const name of CONTRACTS) {
      expect(fs.existsSync(path.join(abisDir, `${name}.json`))).toBe(true)
    }
  })

  it('extrai somente o campo abi — sem bytecode ou outros campos', () => {
    copyAbis(outDir, abisDir)

    const abi = JSON.parse(fs.readFileSync(path.join(abisDir, 'Treasury.json'), 'utf8'))

    expect(Array.isArray(abi)).toBe(true)
    expect(abi[0]).toMatchObject({ type: 'function', name: 'test' })
    expect(abi[0]).not.toHaveProperty('bytecode')
  })

  it('lança erro com mensagem clara quando artefato não existe', () => {
    fs.rmSync(path.join(outDir, 'Treasury.sol'), { recursive: true })

    expect(() => copyAbis(outDir, abisDir)).toThrow('Artefato não encontrado')
  })

  it('instrui a executar yarn compile quando artefato está ausente', () => {
    fs.rmSync(path.join(outDir, 'GovernanceDAO.sol'), { recursive: true })

    expect(() => copyAbis(outDir, abisDir)).toThrow('yarn compile')
  })

  it('sobrescreve arquivo de ABI existente com conteúdo novo', () => {
    copyAbis(outDir, abisDir)

    const updatedAbi = [{ type: 'event', name: 'Updated', inputs: [] }]
    fs.writeFileSync(
      path.join(outDir, 'Treasury.sol', 'Treasury.json'),
      makeArtifact(updatedAbi),
    )
    copyAbis(outDir, abisDir)

    const result = JSON.parse(fs.readFileSync(path.join(abisDir, 'Treasury.json'), 'utf8'))
    expect(result[0]).toMatchObject({ type: 'event', name: 'Updated' })
  })

  it('processa todos os quatro contratos esperados', () => {
    expect(CONTRACTS).toContain('Treasury')
    expect(CONTRACTS).toContain('GovernanceDAO')
    expect(CONTRACTS).toContain('InstitutionRegistry')
    expect(CONTRACTS).toContain('PurchaseManager')
    expect(CONTRACTS).toHaveLength(4)
  })
})
