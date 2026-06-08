import type { PinnedFile, ListFilesOptions } from '@/services/ipfs/provider'
import { cidToBytes32, bytes32ToCid } from '@/lib/cid'

export interface IpfsMetadata {
  title: string
  description: string
  createdAt: string
}

export async function uploadToIPFS(content: string | Blob): Promise<string> {
  const blob =
    typeof content === 'string' ? new Blob([content], { type: 'application/json' }) : content
  const form = new FormData()
  form.append('file', blob)

  const response = await fetch('/api/ipfs/upload', { method: 'POST', body: form })
  if (!response.ok) throw new Error(`Upload IPFS falhou: ${response.status} ${response.statusText}`)

  const { cid } = (await response.json()) as { cid: string }
  return cid
}

export async function uploadToIPFSAsBytes32(content: string | Blob): Promise<string> {
  const cid = await uploadToIPFS(content)
  return cidToBytes32(cid)
}

export async function listIpfsFiles(options?: ListFilesOptions): Promise<PinnedFile[]> {
  const params = new URLSearchParams()
  if (options?.limit !== undefined) params.set('limit', String(options.limit))
  if (options?.name) params.set('name', options.name)

  const url = params.size > 0 ? `/api/ipfs/files?${params}` : '/api/ipfs/files'
  const response = await fetch(url)
  if (!response.ok)
    throw new Error(`Listagem IPFS falhou: ${response.status} ${response.statusText}`)

  return response.json() as Promise<PinnedFile[]>
}

export function getIpfsGatewayUrl(cid: string): string {
  return `https://gateway.pinata.cloud/ipfs/${cid}`
}

export async function fetchFromIPFSByBytes32(bytes32: string): Promise<IpfsMetadata> {
  const cid = bytes32ToCid(bytes32)
  const response = await fetch(`/api/ipfs/fetch/${cid}`)
  if (!response.ok) throw new Error(`Fetch IPFS falhou: ${response.status} ${response.statusText}`)
  return response.json() as Promise<IpfsMetadata>
}
