'use client'

import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'

export default function SetorLayout({ children }: { children: React.ReactNode }) {
  const searchParams = useSearchParams()
  const voltar = searchParams.get('voltar') || ''
  const voltarSeguro = voltar.startsWith('/') && !voltar.startsWith('//') ? voltar : ''

  return (
    <>
      {voltarSeguro && (
        <Link
          href={voltarSeguro}
          className="fixed left-4 top-4 z-[80] inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 shadow-md transition hover:bg-slate-50"
          aria-label="Voltar para a tela anterior"
        >
          <ArrowLeft size={17} />
          Voltar
        </Link>
      )}
      {children}
    </>
  )
}
