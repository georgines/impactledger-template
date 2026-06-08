import { type NextRequest, NextResponse } from 'next/server'
import { PinataProvider } from '@/services/ipfs/pinataProvider'
import { parseServerEnv } from '@/env'
import type { IpfsNetwork } from '@/services/ipfs/provider'

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ network: string; cid: string }> },
): Promise<NextResponse> {
  const { network, cid } = await params

  if (network !== 'public' && network !== 'private') {
    return NextResponse.json(
      { error: 'Rede inválida. Use "public" ou "private".' },
      { status: 400 },
    )
  }

  const { CHAVE_PINATA, URL_GATEWAY_PINATA } = parseServerEnv()
  const provider = new PinataProvider(CHAVE_PINATA, URL_GATEWAY_PINATA)

  const files = await provider.listFiles({ cid, limit: 1, network: network as IpfsNetwork })

  if (files.length === 0) {
    return NextResponse.json({ error: 'Arquivo não encontrado' }, { status: 404 })
  }

  return NextResponse.json(files[0])
}
