import '@mantine/core/styles.css'
import { ColorSchemeScript, mantineHtmlProps } from '@mantine/core'
import type { Metadata } from 'next'
import { Providers } from '@/components/providers/Providers'

export const metadata: Metadata = {
  title: 'EloSolidário',
  description: 'Plataforma de filantropia com transparência e governança verificável',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" {...mantineHtmlProps}>
      <head>
        <ColorSchemeScript />
      </head>
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  )
}
