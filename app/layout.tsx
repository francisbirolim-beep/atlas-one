import type { Metadata, Viewport } from 'next'
import './globals.css'
import './atlas-professional.css'
import './atlas-medicao-professional.css'
import AuthGate from '@/components/AuthGate'
import SincronizadorOffline from '@/components/SincronizadorOffline'
import AgenteChat from '@/components/AgenteChat'

export const metadata: Metadata = {
  title: 'Atlas One - Esquadrifácio',
  description: 'Sistema de Orçamento Inteligente',
  manifest: '/manifest.json',
  icons: {
    icon: [
      { url: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
      { url: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
    ],
    apple: '/icons/apple-touch-icon.png',
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'Atlas One',
  },
}

export const viewport: Viewport = {
  themeColor: '#182444',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body>
        <AuthGate>{children}</AuthGate>
        <SincronizadorOffline />
        <AgenteChat />
        <script
          dangerouslySetInnerHTML={{
            __html: `
              if ('serviceWorker' in navigator) {
                window.addEventListener('load', function () {
                  navigator.serviceWorker.register('/sw.js').catch(function () {})
                })
              }
            `,
          }}
        />
      </body>
    </html>
  )
}
