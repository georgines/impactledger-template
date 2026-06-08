const MAX_FILE_SIZE = 10 * 1024 * 1024

const ALLOWED_TYPES = [
  'application/json',
  'text/plain',
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
]

export function parseLimit(value: string | null): number | undefined {
  if (value === null) return undefined
  const parsed = parseInt(value, 10)
  if (isNaN(parsed) || parsed <= 0) return undefined
  return Math.min(parsed, 100)
}

export function validateUploadFile(file: Blob): string | null {
  if (file.size > MAX_FILE_SIZE) return 'Arquivo muito grande. Máximo permitido: 10 MB.'
  if (!ALLOWED_TYPES.includes(file.type))
    return 'Tipo de arquivo não permitido. Use JSON ou imagem.'
  return null
}
