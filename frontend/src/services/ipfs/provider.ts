export interface PinnedFile {
  id: string
  cid: string
  name: string
  size: number
  createdAt: string
  gatewayUrl: string
}

export type IpfsNetwork = 'public' | 'private'

export interface ListFilesOptions {
  limit?: number
  name?: string
  cid?: string
  network?: IpfsNetwork
}

export interface IpfsProvider {
  upload(content: string | Blob, fileName?: string, network?: IpfsNetwork): Promise<string>
  listFiles(options?: ListFilesOptions): Promise<PinnedFile[]>
  getGatewayUrl(cid: string, network?: IpfsNetwork): string
  fetch(cid: string, network?: IpfsNetwork): Promise<unknown>
}
