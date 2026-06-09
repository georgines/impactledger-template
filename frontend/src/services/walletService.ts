import { BrowserProvider, JsonRpcProvider } from 'ethers'

// Solicita acesso à carteira MetaMask e retorna um BrowserProvider.
export async function connectWallet(): Promise<BrowserProvider> {
  if (!window.ethereum)
    throw new Error(
      'Nenhum aplicativo de carteira digital encontrado. Instale o MetaMask para continuar.',
    )
  const provider = new BrowserProvider(window.ethereum)
  await provider.send('eth_requestAccounts', [])
  return provider
}

// Retorna provider JSON-RPC público que roteia pelo proxy interno /api/rpc.
export function getPublicProvider(): JsonRpcProvider {
  const origin = typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000'
  return new JsonRpcProvider(`${origin}/api/rpc`)
}
