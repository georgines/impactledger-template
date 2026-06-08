import { z } from 'zod'

const serverSchema = z.object({
  CHAVE_PINATA: z.string().min(1, {
    message: 'CHAVE_PINATA é obrigatório para o serviço IPFS',
  }),
  URL_GATEWAY_PINATA: z
    .string()
    .url({ message: 'URL_GATEWAY_PINATA deve ser uma URL válida' })
    .default('https://gateway.pinata.cloud/ipfs'),
})

export type ServerEnv = z.infer<typeof serverSchema>

export function parseServerEnv(): ServerEnv {
  const result = serverSchema.safeParse({
    CHAVE_PINATA: process.env.CHAVE_PINATA,
    URL_GATEWAY_PINATA: process.env.URL_GATEWAY_PINATA,
  })

  if (!result.success) {
    const messages = result.error.issues.map((e) => e.message).join('; ')
    throw new Error(`IPFS não configurado no servidor: ${messages}`)
  }

  return result.data
}

const rpcSchema = z.object({
  URL_RPC: z
    .string()
    .url({ message: 'URL_RPC deve ser uma URL válida' })
    .default('http://127.0.0.1:8545'),
})

export type RpcEnv = z.infer<typeof rpcSchema>

export function parseRpcEnv(): RpcEnv {
  return rpcSchema.parse({ URL_RPC: process.env.URL_RPC })
}
