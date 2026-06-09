import type {
  IpfsProvider,
  IpfsNetwork,
  PinnedFile,
  ListFilesOptions,
} from '@/services/ipfs/provider'

const PINATA_UPLOAD_URL = 'https://uploads.pinata.cloud/v3/files'
const PINATA_FILES_URL = 'https://api.pinata.cloud/v3/files'
const DEFAULT_GATEWAY_URL = 'https://gateway.pinata.cloud/ipfs'

interface PinataFile {
  id: string
  cid: string
  name: string
  size: number
  created_at: string
}

export class PinataProvider implements IpfsProvider {
  private readonly jwt: string
  private readonly gatewayBaseUrl: string

  // Inicializa o provider com o JWT de autenticação e URL base do gateway.
  constructor(jwt: string, gatewayBaseUrl = DEFAULT_GATEWAY_URL) {
    this.jwt = jwt
    this.gatewayBaseUrl = gatewayBaseUrl
  }

  // Faz upload de arquivo para o Pinata e retorna o CID gerado.
  async upload(
    content: string | Blob,
    fileName = 'file.json',
    network: IpfsNetwork = 'public',
  ): Promise<string> {
    const form = buildForm(toBlob(content), fileName, network)
    const response = await fetch(PINATA_UPLOAD_URL, {
      method: 'POST',
      headers: { Authorization: `Bearer ${this.jwt}` },
      body: form,
    })
    if (!response.ok)
      throw new Error(`Upload IPFS falhou: ${response.status} ${response.statusText}`)
    const { data } = (await response.json()) as { data: { cid: string } }
    return data.cid
  }

  // Lista arquivos pinados no Pinata com filtros opcionais de rede, limite, nome e CID.
  async listFiles(options?: ListFilesOptions): Promise<PinnedFile[]> {
    const params = new URLSearchParams()
    params.set('network', options?.network ?? 'public')
    if (options?.limit !== undefined) params.set('limit', String(options.limit))
    if (options?.name) params.set('name', options.name)
    if (options?.cid) params.set('cid', options.cid)

    const url = `${PINATA_FILES_URL}?${params}`
    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${this.jwt}` },
    })
    if (!response.ok)
      throw new Error(`Listagem IPFS falhou: ${response.status} ${response.statusText}`)
    const { data } = (await response.json()) as { data: { files: PinataFile[] } }
    return data.files.map((f) => toPinnedFile(f, this.getGatewayUrl(f.cid, options?.network)))
  }

  // Constrói a URL do gateway para acessar um arquivo por CID e rede (public/private).
  getGatewayUrl(cid: string, network: IpfsNetwork = 'public'): string {
    if (network === 'private') {
      // Arquivos privados usam /files/<cid> no gateway dedicado
      const base = this.gatewayBaseUrl.replace(/\/ipfs\/?$/, '')
      return `${base}/files/${cid}`
    }
    return `${this.gatewayBaseUrl}/${cid}`
  }

  // Busca e parseia JSON de um arquivo IPFS com retry automático em erros de conexão.
  async fetch(cid: string, network: IpfsNetwork = 'public', retries = 3): Promise<unknown> {
    const url = this.getGatewayUrl(cid, network)
    const headers = { Authorization: `Bearer ${this.jwt}` }
    for (let attempt = 1; attempt <= retries; attempt++) {
      try {
        const response = await fetch(url, { headers })
        if (!response.ok)
          throw new Error(`Fetch IPFS falhou: ${response.status} ${response.statusText}`)
        return await response.json()
      } catch (err) {
        const isConnReset =
          err instanceof TypeError &&
          (err as NodeJS.ErrnoException).cause !== undefined &&
          String((err as NodeJS.ErrnoException).cause).includes('ECONNRESET')
        if (!isConnReset || attempt === retries) throw err
        await new Promise((r) => setTimeout(r, 500 * attempt))
      }
    }
  }
}

// Converte string em Blob JSON ou retorna o Blob original.
function toBlob(content: string | Blob): Blob {
  if (typeof content === 'string') return new Blob([content], { type: 'application/json' })
  return content
}

// Monta FormData com arquivo e rede para envio à API do Pinata.
function buildForm(blob: Blob, fileName: string, network: IpfsNetwork): FormData {
  const form = new FormData()
  form.append('file', blob, fileName)
  form.append('network', network)
  return form
}

// Converte resposta da API Pinata no formato interno PinnedFile.
function toPinnedFile(f: PinataFile, gatewayUrl: string): PinnedFile {
  return {
    id: f.id,
    cid: f.cid,
    name: f.name,
    size: f.size,
    createdAt: f.created_at,
    gatewayUrl,
  }
}
