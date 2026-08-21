'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { Boxes, Calculator, FileText, KeyRound, LayoutGrid, LogOut, Moon, Settings, Sun } from 'lucide-react'
import { logout, usuarioAtual } from '@/lib/auth'
import type { Usuario } from '@/lib/tipos'
import { GUIAS } from '@/lib/guias'

type TemaAtlas = 'escuro' | 'claro'

export default function Sidebar() {
  const pathname = usePathname()
  const router = useRouter()
  const [usuario, setUsuario] = useState<Usuario | null>(null)
  const [tema, setTema] = useState<TemaAtlas>('escuro')

  useEffect(() => {
    usuarioAtual().then(setUsuario)
  }, [])

  useEffect(() => {
    if (!usuario?.id) return
    const salvo = window.localStorage.getItem(`atlas-theme:${usuario.id}`)
    const temaInicial: TemaAtlas = salvo === 'claro' ? 'claro' : 'escuro'
    setTema(temaInicial)
    document.documentElement.dataset.atlasTheme = temaInicial
  }, [usuario?.id])

  async function sair() {
    await logout()
    router.replace('/login')
  }

  function alternarTema() {
    const proximo: TemaAtlas = tema === 'escuro' ? 'claro' : 'escuro'
    setTema(proximo)
    document.documentElement.dataset.atlasTheme = proximo
    if (usuario?.id) window.localStorage.setItem(`atlas-theme:${usuario.id}`, proximo)
  }

  function ativo(href: string) {
    if (href === '/') return pathname === '/'
    return pathname === href || pathname.startsWith(`${href}/`)
  }

  return (
    <nav className="hidden h-screen w-60 flex-shrink-0 flex-col border-r border-slate-200 bg-white px-3 py-5 md:flex">
      <div className="px-2 pb-5">
        <p className="text-base font-bold tracking-tight text-brand-navy">Atlas One</p>
        <p className="mt-0.5 text-[11px] font-medium uppercase tracking-[0.14em] text-slate-400">Operação Esquadrifácio</p>
      </div>

      <div className="space-y-1">
        {GUIAS.map(guia => {
          const Icon = guia.icon
          const selecionado = ativo(guia.href)
          return (
            <Link
              key={guia.href}
              href={guia.href}
              className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition ${
                selecionado
                  ? 'bg-brand-navy text-white shadow-sm'
                  : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
              }`}
            >
              <Icon size={18} className="shrink-0" />
              <span>{guia.label}</span>
            </Link>
          )
        })}
      </div>

      {usuario?.role === 'master' && (
        <div className="mt-6 border-t border-slate-100 pt-4">
          <p className="mb-2 px-3 text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-400">Administração</p>
          <Link
            href="/configuracoes"
            className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition ${
              pathname === '/configuracoes' ? 'bg-slate-100 text-brand-navy' : 'text-slate-500 hover:bg-slate-50 hover:text-slate-800'
            }`}
          >
            <Settings size={17} /> Configurações
          </Link>
          <Link
            href="/configuracoes/usuarios"
            className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition ${
              pathname.startsWith('/configuracoes/usuarios') ? 'bg-slate-100 text-brand-navy' : 'text-slate-500 hover:bg-slate-50 hover:text-slate-800'
            }`}
          >
            <KeyRound size={17} /> Usuários e Senhas
          </Link>
          <Link
            href="/configuracoes/orcamento"
            className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition ${
              pathname.startsWith('/configuracoes/orcamento') ? 'bg-slate-100 text-brand-navy' : 'text-slate-500 hover:bg-slate-50 hover:text-slate-800'
            }`}
          >
            <FileText size={17} /> Padrão do Orçamento
          </Link>
          <Link
            href="/engenharia/formulas-corte"
            className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition ${
              pathname.startsWith('/engenharia/formulas-corte') ? 'bg-slate-100 text-brand-navy' : 'text-slate-500 hover:bg-slate-50 hover:text-slate-800'
            }`}
          >
            <Calculator size={17} /> Fórmulas de Corte
          </Link>
          <Link
            href="/setores"
            className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition ${
              pathname.startsWith('/setores') ? 'bg-slate-100 text-brand-navy' : 'text-slate-500 hover:bg-slate-50 hover:text-slate-800'
            }`}
          >
            <LayoutGrid size={17} /> Setores
          </Link>
          <Link
            href="/cadastro"
            className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition ${
              pathname.startsWith('/cadastro') ? 'bg-slate-100 text-brand-navy' : 'text-slate-500 hover:bg-slate-50 hover:text-slate-800'
            }`}
          >
            <Boxes size={17} /> Cadastro
          </Link>
        </div>
      )}

      <div className="mt-auto border-t border-slate-100 pt-4">
        <div className="mb-3 px-3">
          <p className="truncate text-xs font-semibold text-slate-700">{usuario?.nome || 'Usuário'}</p>
          <p className="text-[10px] uppercase tracking-wide text-slate-400">{usuario?.role || ''}</p>
        </div>
        <button
          type="button"
          onClick={alternarTema}
          className="atlas-theme-toggle mb-1 flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-slate-500 transition hover:bg-slate-100 hover:text-slate-800"
          title={tema === 'escuro' ? 'Usar tema claro' : 'Usar tema escuro'}
        >
          {tema === 'escuro' ? <Sun size={17} /> : <Moon size={17} />}
          {tema === 'escuro' ? 'Tema claro' : 'Tema escuro'}
        </button>
        <button
          type="button"
          onClick={sair}
          className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-slate-500 transition hover:bg-red-50 hover:text-red-600"
        >
          <LogOut size={17} /> Sair
        </button>
      </div>
    </nav>
  )
}
