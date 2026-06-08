const requestLog = new Map<string, number[]>()

const WINDOW_MS = 60_000

function getClientKey(request: Request): string {
  return request.headers.get('x-forwarded-for') ?? request.headers.get('x-real-ip') ?? 'unknown'
}

function isLocalhost(request: Request): boolean {
  const ip = request.headers.get('x-forwarded-for') ?? request.headers.get('x-real-ip') ?? ''
  return ip === '127.0.0.1' || ip === '::1' || ip === ''
}

function getRecentTimestamps(key: string): number[] {
  const now = Date.now()
  const windowStart = now - WINDOW_MS
  return (requestLog.get(key) ?? []).filter((t) => t > windowStart)
}

export function isRateLimited(request: Request, maxPerMinute: number): boolean {
  if (process.env.NODE_ENV !== 'production' && isLocalhost(request)) return false

  const key = getClientKey(request)
  const timestamps = getRecentTimestamps(key)

  if (timestamps.length >= maxPerMinute) return true

  timestamps.push(Date.now())
  requestLog.set(key, timestamps)
  return false
}
