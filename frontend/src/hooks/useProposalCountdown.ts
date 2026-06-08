'use client'

import { useEffect, useState } from 'react'

interface CountdownResult {
  secondsLeft: number
  expired: boolean
  display: string
}

function computeSecondsLeft(deadline: bigint): number {
  const now = Math.floor(Date.now() / 1000)
  return Math.max(0, Number(deadline) - now)
}

export function useProposalCountdown(deadline: bigint): CountdownResult {
  const [secondsLeft, setSecondsLeft] = useState(() => computeSecondsLeft(deadline))

  useEffect(() => {
    setSecondsLeft(computeSecondsLeft(deadline))

    const interval = setInterval(() => {
      const remaining = computeSecondsLeft(deadline)
      setSecondsLeft(remaining)
      if (remaining === 0) clearInterval(interval)
    }, 1000)

    return () => clearInterval(interval)
  }, [deadline])

  const expired = secondsLeft === 0
  const display = expired ? 'Expirada' : formatCountdown(secondsLeft)

  return { secondsLeft, expired, display }
}

function formatCountdown(seconds: number): string {
  const days = Math.floor(seconds / 86400)
  const hours = Math.floor((seconds % 86400) / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  const secs = seconds % 60

  if (days > 0) return `${days}d ${hours}h ${minutes}min ${secs}s`
  if (hours > 0) return `${hours}h ${minutes}min ${secs}s`
  if (minutes > 0) return `${minutes}min ${secs}s`
  return `${secs}s`
}
