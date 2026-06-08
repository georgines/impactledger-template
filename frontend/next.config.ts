import path from 'path'
import type { NextConfig } from 'next'
import { loadEnvConfig } from '@next/env'

loadEnvConfig(path.resolve(__dirname, '..'))

const isProduction = process.env.NODE_ENV === 'production'
const isLocal = process.env.REDE_DEPLOY === 'local' || !isProduction

const scriptSrc =
  isProduction && !isLocal ? "'self' 'unsafe-inline'" : "'self' 'unsafe-inline' 'unsafe-eval'"
const connectSrc = isLocal
  ? "'self' http://localhost:8545 http://127.0.0.1:8545 http://localhost:3000 https://gateway.pinata.cloud https://*.mypinata.cloud"
  : "'self' https://gateway.pinata.cloud https://*.mypinata.cloud"

const csp = [
  "default-src 'self'",
  `script-src ${scriptSrc}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https://gateway.pinata.cloud https://*.mypinata.cloud",
  `connect-src ${connectSrc}`,
  "font-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "frame-ancestors 'none'",
].join('; ')

const securityHeaders = [
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
  { key: 'Content-Security-Policy', value: csp },
  ...(isProduction
    ? [{ key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' }]
    : []),
]

const nextConfig: NextConfig = {
  reactStrictMode: true,
  typedRoutes: true,
  async headers() {
    return [{ source: '/(.*)', headers: securityHeaders }]
  },
  turbopack: {
    resolveAlias: {
      '@deploy-atual': `./src/deploy/${process.env.REDE_DEPLOY ?? 'local'}.json`,
    },
  },
  webpack(config) {
    const rede = process.env.REDE_DEPLOY ?? 'local'
    config.resolve.alias['@deploy-atual'] = path.resolve(__dirname, 'src', 'deploy', `${rede}.json`)
    return config
  },
}

export default nextConfig
