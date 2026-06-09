// Carrega variáveis de ambiente do .env no runtime Node.js do Next.js.
export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const path = await import('path')
    const { loadEnvConfig } = await import('@next/env')
    loadEnvConfig(path.resolve(process.cwd(), '..'), false, undefined, true)
  }
}
