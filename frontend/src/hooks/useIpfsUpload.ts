'use client'

import { useState } from 'react'
import { uploadToIPFS, uploadToIPFSAsBytes32 } from '@/services/ipfsService'

export function useIpfsUpload() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

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
