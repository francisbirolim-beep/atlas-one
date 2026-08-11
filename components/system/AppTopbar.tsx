'use client'

import { useEffect, useMemo, useState } from 'react'
import { usePathname } from 'next/navigation'
import { Bell, Search, Sparkles } from 'lucide-react'
import { usuarioAtual } from '@/lib/auth'
import type { Usuario } from '@/lib/tipos'

const TITULOS: { prefixo: string; titulo: string; grupo: string }[] = [
  { prefixo: '/kanban', titulo: 'Kanban Comercial', grupo: 'Comercial' },
  { prefixo: '/vendas/confirmar', titulo: 'Confirmar Venda', grupo: 'Comercial' },
  { prefixo: '/orcamento', titulo: 'Orçamentos', grupo: 'Comercial' },
  { prefixo: '/clientes', titulo: 'Clientes', grupo: 'Comercial' },
  { prefixo: '/crm', titulo: 'CRM', grupo: 'Comercial' },
  { prefixo: '/producao/medicao-final', titulo: 'Medição Final', grupo: 'Operação' },
  { prefixo: '/producao', titulo: 'Produção', grupo: 'Operação' },
  { prefixo: '/setores', titulo: 'Setores', grupo: 'Operação' },
  { prefixo: '/financeiro', titulo: 'Financeiro', grupo: 'Financeiro' },
  { prefixo: '/configuracoes', titulo: 'Configurações', grupo: 'Administração' },
  { prefixo: '/historico', titulo: 'Histórico', grupo: 'Administração' },
]

function iniciais(nome?: string | null) {
  const partes = (nome || 'Usuário').trim().split(/\s+/).filter(Boolean)
  return partes.slice(0, 2).map(p => p[0]?.toUpperCase()).join('') || 'U'
}

export default function AppTopbar() {
  const pathname = usePathname()
  const [usuario, setUsuario] = useState<Usuario | null>(null)

  useEffect(() => {
    usuarioAtual().then(setUsuario)
  }, [])

  const contexto = useMemo(() => {
    if (pathname === '/') {
      return { titulo: 'Painel de Gestão', grupo: 'Visão geral' }
    }

    return TITULOS.find(item => pathname.startsWith(item.prefixo)) || {
      titulo: 'Atlas One',
      grupo: 'Sistema',
    }
  }, [pathname])

  return (
    <header className="sticky top-0 z-30 border-b border-slate-200/80 bg-white/95 shadow-sm backdrop-blur">
      <div className="flex h-16 items-center gap-3 px-3 sm:px-4 md:px-6">
        <div className="flex min-w-0 flex-1 items-center gap-3">
          <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl bg-brand-navy text-white md:hidden">
            <Sparkles size={17} />
          </div>
          <div className="min-w-0">
            <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-400 sm:text-[11px]">
              {contexto.grupo}
            </div>
            <div className="truncate text-sm font-semibold text-slate-900 sm:text-base">{contexto.titulo}</div>
          </div>
        </div>

        <div className="hidden items-center gap-2 lg:flex">
          <button
            type="button"
            className="flex h-9 min-w-64 items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 text-left text-sm text-slate-400 transition hover:border-slate-300 hover:bg-white"
            title="Busca global — em breve"
          >
            <Search size={15} />
            <span className="flex-1">Buscar cliente, obra ou orçamento</span>
            <kbd className="rounded border border-slate-200 bg-white px-1.5 py-0.5 text-[10px] text-slate-400">Ctrl K</kbd>
          </button>
          <button
            type="button"
            className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-500 transition hover:bg-slate-50"
            title="Notificações — em breve"
          >
            <Bell size={16} />
          </button>
        </div>

        <button
          type="button"
          className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-500 lg:hidden"
          title="Busca global — em breve"
        >
          <Search size={16} />
        </button>

        <div className="flex items-center gap-2 border-l border-slate-200 pl-2 sm:pl-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-navy text-xs font-bold text-white shadow-sm">
            {iniciais(usuario?.nome)}
          </div>
          <div className="hidden min-w-0 sm:block">
            <div className="max-w-36 truncate text-sm font-medium text-slate-800">{usuario?.nome || 'Usuário'}</div>
            <div className="text-[11px] capitalize text-slate-400">{usuario?.role || ''}</div>
          </div>
        </div>
      </div>
    </header>
  )
}
