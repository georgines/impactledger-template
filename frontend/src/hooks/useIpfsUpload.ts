'use client'

import { useState } from 'react'
import { uploadToIPFS, uploadToIPFSAsBytes32 } from '@/services/ipfsService'

// Hook com funções de upload para o IPFS com gestão de loading e erro.
export function useIpfsUpload() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Faz upload de conteúdo para o IPFS e retorna o CID.
  async function upload(content: string | Blob): Promise<string> {
    setLoading(true)
    setError(null)
    try {
      return await uploadToIPFS(content)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro ao fazer upload'
      setError(message)
      throw err
    } finally {
      setLoading(false)
    }
  }

  // Faz upload para o IPFS e retorna o CID convertido em bytes32.
  async function uploadAsBytes32(content: string | Blob): Promise<string> {
    setLoading(true)
    setError(null)
    try {
      return await uploadToIPFSAsBytes32(content)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro ao fazer upload'
      setError(message)
      throw err
    } finally {
      setLoading(false)
    }
  }

  return { upload, uploadAsBytes32, loading, error }
}
