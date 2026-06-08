import { type NextRequest, NextResponse } from 'next/server'
import { PinataProvider } from '@/services/ipfs/pinataProvider'
import { parseServerEnv } from '@/env'
import type { IpfsNetwork } from '@/services/ipfs/provider'
import { validateUploadFile } from '@/lib/uploadValidation'
import { isRateLimited } from '@/lib/rateLimiter'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ network: string }> },
): Promise<NextResponse> {
  if (isRateLimited(request, 10))
    return NextResponse.json(
      { error: 'Muitas requisições. Tente novamente em 1 minuto.' },
      { status: 429 },
    )

  const { network } = await params

  if (network !== 'public' && network !== 'private')
    return NextResponse.json(
      { error: 'Rede inválida. Use "public" ou "private".' },
      { status: 400 },
    )

  const form = await request.formData()
  const file = form.get('file')

  if (!file || !(file instanceof Blob))
    return NextResponse.json({ error: 'Arquivo ausente na requisição' }, { status: 400 })

  const validationError = validateUploadFile(file)
  if (validationError) return NextResponse.json({ error: validationError }, { status: 400 })

  const { CHAVE_PINATA } = parseServerEnv()
  const provider = new PinataProvider(CHAVE_PINATA)
  const fileName = file instanceof File ? file.name : 'file.json'
  const cid = await provider.upload(file, fileName, network as IpfsNetwork)

  return NextResponse.json({ cid, network })
}
