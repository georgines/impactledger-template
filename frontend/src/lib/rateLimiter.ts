const requestLog = new Map<string, number[]>()

const WINDOW_MS = 60_000

// Extrai chave de identificação do cliente a partir dos headers da requisição.
function getClientKey(request: Request): string {
  return request.headers.get('x-forwarded-for') ?? request.headers.get('x-real-ip') ?? 'unknown'
}

// Verifica se a requisição vem de localhost (sem rate limit em dev).
function isLocalhost(request: Request): boolean {
  const ip = request.headers.get('x-forwarded-for') ?? request.headers.get('x-real-ip') ?? ''
  return ip === '127.0.0.1' || ip === '::1' || ip === ''
}

// Retorna timestamps de requisições recentes dentro da janela de 1 minuto.
function getRecentTimestamps(key: string): number[] {
  const now = Date.now()
  const windowStart = now - WINDOW_MS
  return (requestLog.get(key) ?? []).filter((t) => t > windowStart)
}

// Retorna true se o cliente excedeu o limite de requisições por minuto.
export function isRateLimited(request: Request, maxPerMinute: number): boolean {
  if (process.env.NODE_ENV !== 'production' && isLocalhost(request)) return false

  const key = getClientKey(request)
  const timestamps = getRecentTimestamps(key)

  if (timestamps.length >= maxPerMinute) return true

  timestamps.push(Date.now())
  requestLog.set(key, timestamps)
  return false
}
