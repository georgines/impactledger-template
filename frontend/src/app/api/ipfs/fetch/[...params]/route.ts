import { type NextRequest, NextResponse } from 'next/server'
import { PinataProvider } from '@/services/ipfs/pinataProvider'
import { parseServerEnv } from '@/env'
import type { IpfsNetwork } from '@/services/ipfs/provider'
import { isRateLimited } from '@/lib/rateLimiter'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ params: string[] }> },
): Promise<NextResponse> {
  if (isRateLimited(request, 30))
    return NextResponse.json(
      { error: 'Muitas requisições. Tente novamente em 1 minuto.' },
      { status: 429 },
    )

  const { params: segments } = await params
  const { CHAVE_PINATA, URL_GATEWAY_PINATA } = parseServerEnv()
  const provider = new PinataProvider(CHAVE_PINATA, URL_GATEWAY_PINATA)

  if (segments.length === 1) {
    const [cid] = segments
    const data = await provider.fetch(cid)
    return NextResponse.json(data)
  }

  if (segments.length === 2) {
    const [network, cid] = segments
    if (network !== 'public' && network !== 'private')
      return NextResponse.json(
        { error: 'Rede inválida. Use "public" ou "private".' },
        { status: 400 },
      )
    const data = await provider.fetch(cid, network as IpfsNetwork)
    return NextResponse.json(data)
  }

  return NextResponse.json({ error: 'Rota inválida.' }, { status: 400 })
}
