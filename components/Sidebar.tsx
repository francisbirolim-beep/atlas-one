'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { FileText, Wrench, LogOut, Home } from 'lucide-react'
import { logout } from '@/lib/auth'

const ATALHOS = [
  { href: '/orcamento-rapido', label: 'Orçamento', icon: FileText, cor: 'navy' as const },
  { href: '/assistencia', label: 'Assistência', icon: Wrench, cor: 'teal' as const },
]

export default function Sidebar() {
  const pathname = usePathname()
  const router = useRouter()

  async function sair() {
    await logout()
    router.replace('/login')
  }

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-40 flex items-center justify-around border-t border-slate-200 bg-white px-2 py-1.5
                 lg:static lg:h-screen lg:w-20 lg:flex-col lg:justify-start lg:gap-2 lg:border-r lg:border-t-0 lg:py-6"
    >
      <Link
        href="/"
        title="Início"
        className="hidden h-11 w-11 items-center justify-center rounded-xl bg-brand-navy font-bold text-white lg:mb-4 lg:flex"
      >
        A1
      </Link>

      <Link
        href="/"
        title="Início"
        className={`flex h-14 w-14 flex-col items-center justify-center gap-1 rounded-xl transition lg:h-16 lg:w-16
                    ${pathname === '/' ? 'bg-slate-200 text-slate-700' : 'text-slate-500 hover:bg-slate-100'}`}
      >
        <Home size={20} />
        <span className="text-[10px] leading-none">Início</span>
      </Link>

      {ATALHOS.map((a) => {
        const ativo = pathname === a.href
        const Icon = a.icon
        const corAtiva = a.cor === 'navy' ? 'bg-brand-navy text-white' : 'bg-brand-teal text-white'
        return (
          <Link
            key={a.href}
            href={a.href}
            title={a.label}
            className={`flex h-14 w-14 flex-col items-center justify-center gap-1 rounded-xl transition lg:h-16 lg:w-16
                        ${ativo ? corAtiva : 'text-slate-500 hover:bg-slate-100'}`}
          >
            <Icon size={20} />
            <span className="text-[10px] leading-none">{a.label}</span>
          </Link>
        )
      })}

      <button
        onClick={sair}
        title="Sair"
        className="flex h-14 w-14 flex-col items-center justify-center gap-1 rounded-xl text-slate-400 transition hover:bg-slate-100 hover:text-red-500 lg:mt-auto lg:h-16 lg:w-16"
      >
        <LogOut size={20} />
        <span className="text-[10px] leading-none">Sair</span>
      </button>
    </nav>
  )
}
