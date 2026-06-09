import { type NextRequest, NextResponse } from 'next/server'
import { PinataProvider } from '@/services/ipfs/pinataProvider'
import { parseServerEnv } from '@/env'
import type { IpfsNetwork } from '@/services/ipfs/provider'

// Lista arquivos de uma rede IPFS específica (public ou private) com filtros opcionais.
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ network: string }> },
): Promise<NextResponse> {
  const { network } = await params

  if (network !== 'public' && network !== 'private') {
    return NextResponse.json(
      { error: 'Rede inválida. Use "public" ou "private".' },
      { status: 400 },
    )
  }

  const { CHAVE_PINATA, URL_GATEWAY_PINATA } = parseServerEnv()
  const provider = new PinataProvider(CHAVE_PINATA, URL_GATEWAY_PINATA)

  const { searchParams } = request.nextUrl
  const limitParam = searchParams.get('limit')
  const nameParam = searchParams.get('name')

  const files = await provider.listFiles({
    network: network as IpfsNetwork,
    limit: limitParam !== null ? Number(limitParam) : undefined,
    name: nameParam ?? undefined,
  })

  return NextResponse.json(files)
}
