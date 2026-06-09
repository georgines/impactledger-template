import { type NextRequest, NextResponse } from 'next/server'
import { PinataProvider } from '@/services/ipfs/pinataProvider'
import { parseServerEnv } from '@/env'
import { parseLimit } from '@/lib/uploadValidation'
import { isRateLimited } from '@/lib/rateLimiter'

// Lista arquivos pinados no Pinata com filtros opcionais de limite, nome e CID.
export async function GET(request: NextRequest): Promise<NextResponse> {
  if (isRateLimited(request, 30))
    return NextResponse.json(
      { error: 'Muitas requisições. Tente novamente em 1 minuto.' },
      { status: 429 },
    )

  const { CHAVE_PINATA, URL_GATEWAY_PINATA } = parseServerEnv()
  const provider = new PinataProvider(CHAVE_PINATA, URL_GATEWAY_PINATA)

  const { searchParams } = request.nextUrl

  const files = await provider.listFiles({
    limit: parseLimit(searchParams.get('limit')),
    name: searchParams.get('name') ?? undefined,
    cid: searchParams.get('cid') ?? undefined,
  })

  return NextResponse.json(files)
}
