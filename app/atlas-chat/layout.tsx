import type { Metadata } from 'next'
export const metadata: Metadata = {
  title: 'Atlas Chat - Esquadrifácio',
  manifest: '/atlas-chat.webmanifest',
  appleWebApp: { capable: true, title: 'Atlas Chat', statusBarStyle: 'default' },
  icons: { icon: '/atlas-chat-icon.svg', apple: '/icons/apple-touch-icon.png' },
}
export default function Layout({ children }: { children: React.ReactNode }) { return children }
