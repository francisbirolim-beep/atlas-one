'use client'

import { ArrowLeft, Home } from 'lucide-react'
import { usePathname, useRouter } from 'next/navigation'

export default function MobileNavigationControls() {
  const router = useRouter()
  const pathname = usePathname()
  const naHome = pathname === '/'

  function voltar() {
    if (typeof window !== 'undefined' && window.history.length > 1) {
      router.back()
      return
    }
    router.push('/')
  }

  if (naHome) return null

  return (
    <div className="fixed bottom-[max(1rem,env(safe-area-inset-bottom))] left-3 z-50 flex items-center gap-2 md:hidden">
      <button
        type="button"
        onClick={voltar}
        aria-label="Voltar"
        title="Voltar"
        className="flex h-12 items-center gap-2 rounded-2xl border border-slate-200 bg-white/95 px-3.5 text-sm font-semibold text-slate-700 shadow-lg shadow-slate-900/10 backdrop-blur transition active:scale-[0.98]"
      >
        <ArrowLeft size={19} />
        <span>Voltar</span>
      </button>

      <button
        type="button"
        onClick={() => router.push('/')}
        aria-label="Ir para o início"
        title="Início"
        className="flex h-12 items-center gap-2 rounded-2xl border border-slate-200 bg-white/95 px-3.5 text-sm font-semibold text-slate-700 shadow-lg shadow-slate-900/10 backdrop-blur transition active:scale-[0.98]"
      >
        <Home size={18} />
        <span>Início</span>
      </button>
    </div>
  )
}
