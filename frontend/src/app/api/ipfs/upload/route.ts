import { type NextRequest, NextResponse } from 'next/server'
import { PinataProvider } from '@/services/ipfs/pinataProvider'
import { parseServerEnv } from '@/env'
import { validateUploadFile } from '@/lib/uploadValidation'
import { isRateLimited } from '@/lib/rateLimiter'

export async function POST(request: NextRequest): Promise<NextResponse> {
  if (isRateLimited(request, 10))
    return NextResponse.json(
      { error: 'Muitas requisições. Tente novamente em 1 minuto.' },
      { status: 429 },
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
  const cid = await provider.upload(file, fileName)

  return NextResponse.json({ cid })
}
