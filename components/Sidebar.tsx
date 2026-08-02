'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { FileText, Wrench, LogOut, Home, Menu, X, Star } from 'lucide-react'
import { logout, usuarioAtual } from '@/lib/auth'
import { Usuario } from '@/lib/tipos'
import { GUIAS, lerOcultos, alternarOculto, EVENTO_OCULTOS_MUDOU } from '@/lib/guias'

const ATALHOS = [
  { href: '/orcamento-rapido', label: 'Orçamento', icon: FileText, cor: 'navy' as const },
  { href: '/assistencia', label: 'Assistência', icon: Wrench, cor: 'teal' as const },
]

export default function Sidebar() {
  const pathname = usePathname()
  const router = useRouter()
  const [usuario, setUsuario] = useState<Usuario | null>(null)
  const [ocultos, setOcultos] = useState<string[]>([])
  const [abrirMais, setAbrirMais] = useState(false)

  useEffect(() => {
    usuarioAtual().then(setUsuario)
    setOcultos(lerOcultos())
    function sync() {
      setOcultos(lerOcultos())
    }
    window.addEventListener(EVENTO_OCULTOS_MUDOU, sync)
    return () => window.removeEventListener(EVENTO_OCULTOS_MUDOU, sync)
  }, [])

  async function sair() {
    await logout()
    router.replace('/login')
  }

  const resto = GUIAS.filter((g) => !g.masterOnly || usuario?.role === 'master').filter((g) =>
    ocultos.includes(g.href)
  )

  function favoritar(href: string) {
    setOcultos(alternarOculto(href))
  }

  return (
    <>
      <nav
        className="fixed bottom-0 left-0 right-0 z-40 flex items-center justify-around border-t border-slate-200 bg-white px-2 py-1.5
                   lg:static lg:h-screen lg:w-56 lg:flex-col lg:items-stretch lg:justify-start lg:gap-0 lg:border-r lg:border-t-0 lg:py-6"
      >
        <div className="hidden lg:flex lg:flex-col lg:items-center lg:gap-2 lg:px-2">
          <Link
            href="/"
            title="Início"
            className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl bg-brand-navy font-bold text-white"
          >
            A1
          </Link>

          <Link
            href="/"
            title="Início"
            className={`flex h-14 w-14 flex-col items-center justify-center gap-1 rounded-xl transition
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
                className={`flex h-14 w-14 flex-col items-center justify-center gap-1 rounded-xl transition
                            ${ativo ? corAtiva : 'text-slate-500 hover:bg-slate-100'}`}
              >
                <Icon size={20} />
                <span className="text-[10px] leading-none">{a.label}</span>
              </Link>
            )
          })}
        </div>

        {resto.length > 0 && (
          <div className="hidden lg:mt-6 lg:block lg:flex-1 lg:overflow-y-auto lg:px-3">
            <p className="mb-2 px-1 text-[10px] font-semibold uppercase tracking-wide text-slate-400">Mais</p>
            <div className="space-y-0.5">
              {resto.map((g) => {
                const ativo = pathname === g.href
                return (
                  <div key={g.href} className="group flex items-center">
                    <Link
                      href={g.href}
                      className={`flex-1 truncate rounded-lg px-2 py-1.5 text-xs transition
                                  ${ativo ? 'bg-slate-100 font-medium text-brand-navy' : 'text-slate-500 hover:bg-slate-50 hover:text-slate-700'}`}
                    >
                      {g.label}
                    </Link>
                    <button
                      onClick={() => favoritar(g.href)}
                      title="Colocar no guia rápido"
                      className="p-1 text-slate-300 opacity-0 hover:text-amber-400 group-hover:opacity-100"
                    >
                      <Star size={12} />
                    </button>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        <div className="hidden lg:mt-auto lg:block lg:px-2 lg:pt-4">
          <button
            onClick={sair}
            title="Sair"
            className="flex h-14 w-14 flex-col items-center justify-center gap-1 rounded-xl text-slate-400 transition hover:bg-slate-100 hover:text-red-500"
          >
            <LogOut size={20} />
            <span className="text-[10px] leading-none">Sair</span>
          </button>
        </div>

        <Link
          href="/"
          title="Início"
          className={`flex h-14 w-14 flex-col items-center justify-center gap-1 rounded-xl transition lg:hidden
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
              className={`flex h-14 w-14 flex-col items-center justify-center gap-1 rounded-xl transition lg:hidden
                          ${ativo ? corAtiva : 'text-slate-500 hover:bg-slate-100'}`}
            >
              <Icon size={20} />
              <span className="text-[10px] leading-none">{a.label}</span>
            </Link>
          )
        })}

        {resto.length > 0 && (
          <button
            onClick={() => setAbrirMais(true)}
            title="Mais"
            className="flex h-14 w-14 flex-col items-center justify-center gap-1 rounded-xl text-slate-400 transition hover:bg-slate-100 lg:hidden"
          >
            <Menu size={20} />
            <span className="text-[10px] leading-none">Mais</span>
          </button>
        )}

        <button
          onClick={sair}
          title="Sair"
          className="flex h-14 w-14 flex-col items-center justify-center gap-1 rounded-xl text-slate-400 transition hover:bg-slate-100 hover:text-red-500 lg:hidden"
        >
          <LogOut size={20} />
          <span className="text-[10px] leading-none">Sair</span>
        </button>
      </nav>

      {abrirMais && (
        <div className="fixed inset-0 z-50 flex items-end bg-black/40 lg:hidden" onClick={() => setAbrirMais(false)}>
          <div
            className="max-h-[70vh] w-full overflow-y-auto rounded-t-2xl bg-white p-4 pb-8"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-3 flex items-center justify-between">
              <p className="text-sm font-semibold text-slate-700">Mais guias</p>
              <button onClick={() => setAbrirMais(false)} className="text-slate-400">
                <X size={18} />
              </button>
            </div>
            <div className="space-y-1">
              {resto.map((g) => (
                <div key={g.href} className="flex items-center">
                  <Link
                    href={g.href}
                    onClick={() => setAbrirMais(false)}
                    className="flex-1 rounded-lg px-2 py-2 text-sm text-slate-600 hover:bg-slate-50"
                  >
                    {g.label}
                  </Link>
                  <button onClick={() => favoritar(g.href)} className="p-2 text-slate-300 hover:text-amber-400">
                    <Star size={14} />
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  )
}
