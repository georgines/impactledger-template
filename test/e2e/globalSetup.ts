/**
 * Playwright Global Setup
 *
 * Executado UMA VEZ antes de todos os testes.
 *
 * O que faz:
 *  1. Verifica se Anvil está rodando em localhost:8545.
 *  2. Reseta o Anvil para genesis (anvil_reset).
 *  3. Faz o deploy dos contratos (yarn deploy:local).
 *  4. Tira um snapshot do estado logo após o deploy (sem bootstrap).
 *     O ID do snapshot é salvo em e2e/.snapshot para globalTeardown e testes.
 *
 * O reset garante que o deployer começa com nonce 0, produzindo os mesmos
 * endereços que estão em frontend/src/deploy/local.json.
 */

import { execSync } from 'child_process';
import path from 'path';
import fs from 'fs';
import { isAnvilRunning, resetAnvil, takeSnapshot, anvilRpc } from './helpers/anvilHelpers';

const SNAPSHOT_FILE = path.resolve(__dirname, '.snapshot');
const ROOT = path.resolve(__dirname, '../..');

export default async function globalSetup() {
  console.log('\n🔧 [globalSetup] Verificando Anvil...');

  if (!(await isAnvilRunning())) {
    throw new Error(
      '\n❌ Anvil não está rodando em localhost:8545.\n' +
        '   Inicie com: anvil --block-time 1\n',
    );
  }

  console.log('🔧 [globalSetup] Resetando blockchain para genesis...');
  await resetAnvil();

  console.log('🔧 [globalSetup] Aguardando reset...');
  await new Promise((r) => setTimeout(r, 500));

  console.log('🔧 [globalSetup] Deployando contratos...');
  execSync('yarn deploy:local', { cwd: ROOT, stdio: 'inherit' });

  // Sincroniza o timestamp do Anvil com o tempo real para que os contadores
  // de prazo (usados pelo frontend via Date.now()) funcionem corretamente.
  console.log('🔧 [globalSetup] Sincronizando timestamp do Anvil com tempo real...');
  const realNow = Math.floor(Date.now() / 1000);
  await anvilRpc('evm_setNextBlockTimestamp', [realNow]);
  await anvilRpc('evm_mine');

  console.log('🔧 [globalSetup] Aguardando 1s para estabilizar...');
  await new Promise((r) => setTimeout(r, 1000));

  // Verifica que o deploy produziu os endereços corretos
  const localJson = JSON.parse(
    fs.readFileSync(path.resolve(ROOT, 'frontend/src/deploy/local.json'), 'utf-8'),
  ) as { contracts: Record<string, string> };
  const govAddr = localJson.contracts.GovernanceDAO;

  const operator = (await anvilRpc('eth_call', [
    { to: govAddr, data: '0x570ca735' }, // operator()
    'latest',
  ])) as string;
  console.log(`🔧 [globalSetup] Operador detectado: 0x${operator.slice(-40)}`);

  // Snapshot sem bootstrap
  const snapshotId = await takeSnapshot();
  fs.writeFileSync(SNAPSHOT_FILE, snapshotId, 'utf-8');
  console.log(`✅ [globalSetup] Snapshot salvo: ${snapshotId}\n`);
}
