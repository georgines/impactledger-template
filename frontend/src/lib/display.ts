export const AREA_COLORS: Record<string, string> = {
  saúde: 'teal',
  educação: 'blue',
  assistência: 'violet',
  ambiente: 'green',
  social: 'cyan',
}

export function resolveAreaColor(areaOfWork: string): string {
  const lower = areaOfWork.toLowerCase()
  for (const [key, color] of Object.entries(AREA_COLORS)) {
    if (lower.includes(key)) return color
  }
  return 'indigo'
}

export function getInitials(name: string): string {
  return name
    .split(' ')
    .slice(0, 2)
    .map((w) => w[0] ?? '')
    .join('')
    .toUpperCase()
}
