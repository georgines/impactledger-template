/**
 * Funções utilitárias para interagir com o Anvil via JSON-RPC a partir do Node.js.
 */

export const ANVIL_RPC = 'http://localhost:8545';

export async function anvilRpc(method: string, params: unknown[] = []): Promise<unknown> {
  const res = await fetch(ANVIL_RPC, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: Date.now(), method, params }),
  });
  const json = (await res.json()) as { result?: unknown; error?: { message: string } };
  if (json.error) throw new Error(`Anvil RPC [${method}]: ${json.error.message}`);
  return json.result;
}

/** Salva snapshot do estado EVM. Retorna o ID do snapshot. */
export async function takeSnapshot(): Promise<string> {
  return (await anvilRpc('evm_snapshot')) as string;
}

/** Reverte para um snapshot salvo anteriormente. */
export async function revertSnapshot(snapshotId: string): Promise<void> {
  await anvilRpc('evm_revert', [snapshotId]);
}

/** Avança o tempo do EVM e minera um bloco. */
export async function increaseTime(seconds: number): Promise<void> {
  await anvilRpc('evm_increaseTime', [seconds]);
  await anvilRpc('evm_mine');
}

/** Reseta o Anvil para o estado genesis. */
export async function resetAnvil(): Promise<void> {
  await anvilRpc('anvil_reset');
}

/** Verifica se Anvil está acessível. */
export async function isAnvilRunning(): Promise<boolean> {
  try {
    await anvilRpc('eth_blockNumber');
    return true;
  } catch {
    return false;
  }
}
