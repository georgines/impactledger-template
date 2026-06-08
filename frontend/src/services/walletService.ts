import { BrowserProvider, JsonRpcProvider } from 'ethers'

export async function connectWallet(): Promise<BrowserProvider> {
  if (!window.ethereum)
    throw new Error(
      'Nenhum aplicativo de carteira digital encontrado. Instale o MetaMask para continuar.',
    )
  const provider = new BrowserProvider(window.ethereum)
  await provider.send('eth_requestAccounts', [])
  return provider
}

export function getPublicProvider(): JsonRpcProvider {
  const origin = typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000'
  return new JsonRpcProvider(`${origin}/api/rpc`)
}
