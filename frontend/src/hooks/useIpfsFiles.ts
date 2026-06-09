'use client'

import { useState } from 'react'
import { listIpfsFiles } from '@/services/ipfsService'
import type { PinnedFile, ListFilesOptions } from '@/services/ipfs/provider'

// Hook para listar arquivos pinados no IPFS com gestão de loading e erro.
export function useIpfsFiles() {
  const [files, setFiles] = useState<PinnedFile[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Busca arquivos IPFS com opções de filtro e atualiza o estado.
  async function fetchFiles(options?: ListFilesOptions): Promise<void> {
    setLoading(true)
    setError(null)
    try {
      const result = await listIpfsFiles(options)
      setFiles(result)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro ao listar arquivos'
      setError(message)
      throw err
    } finally {
      setLoading(false)
    }
  }

  return { files, loading, error, fetchFiles }
}
