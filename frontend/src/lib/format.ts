// Abrevia um endereço Ethereum no formato 0x1234...abcd.
export function truncateAddress(address: string): string {
  return `${address.slice(0, 6)}...${address.slice(-4)}`
}

// Formata um timestamp Unix (segundos) como data no padrão pt-BR.
export function formatDate(timestamp: number): string {
  if (!timestamp) return '—'
  return new Date(timestamp * 1000).toLocaleDateString('pt-BR')
}
