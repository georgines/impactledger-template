import { type NextRequest, NextResponse } from 'next/server'
import { parseRpcEnv } from '@/env'
import { isRateLimited } from '@/lib/rateLimiter'

export async function POST(request: NextRequest): Promise<NextResponse> {
  if (isRateLimited(request, 60))
    return NextResponse.json(
      { error: 'Muitas requisições. Tente novamente em 1 minuto.' },
      { status: 429 },
    )

  const { URL_RPC } = parseRpcEnv()
  const body = await request.text()

  try {
    const response = await fetch(URL_RPC, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body,
    })

    const data = await response.text()
    return new NextResponse(data, {
      status: response.status,
      headers: { 'Content-Type': 'application/json' },
    })
  } catch {
    return NextResponse.json(
      { jsonrpc: '2.0', id: null, error: { code: -32603, message: 'Nó RPC indisponível' } },
      { status: 503 },
    )
  }
}
