'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { MessageCircle } from 'lucide-react'

export default function BotaoChatGlobal() {
  const pathname = usePathname()
  if (pathname.startsWith('/chat')) return null
  return (
    <Link
      href="/chat"
      aria-label="Abrir Chat interno"
      title="Chat interno"
      className="fixed bottom-[calc(env(safe-area-inset-bottom)+7rem)] right-4 z-[80] flex h-14 w-14 items-center justify-center rounded-full bg-brand-navy text-white shadow-lg ring-1 ring-black/5 transition hover:scale-105 hover:shadow-xl focus:outline-none focus:ring-2 focus:ring-brand-navy focus:ring-offset-2 sm:bottom-6 sm:right-6"
    >
      <MessageCircle size={25} aria-hidden="true" />
      <span className="sr-only">Chat interno</span>
    </Link>
  )
}
