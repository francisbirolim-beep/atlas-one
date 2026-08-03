{restoOrdenado.map((g, i) => (
                <div key={g.href} className="flex items-center">
                  <Link
                    href={g.href}
                    onClick={() => setAbrirMais(false)}
                    className="flex-1 rounded-lg px-2 py-2 text-sm text-slate-600 hover:bg-slate-50"
                  >
                    {g.label}
                  </Link>
                  <button
                    onClick={() => mover(g.href, 'cima')}
                    disabled={i === 0}
                    className="p-2 text-slate-300 disabled:opacity-30"
                  >
                    <ChevronUp size={14} />
                  </button>
                  <button
                    onClick={() => mover(g.href, 'baixo')}
                    disabled={i === restoOrdenado.length - 1}
                    className="p-2 text-slate-300 disabled:opacity-30"
                  >
                    <ChevronDown size={14} />
                  </button>
                  <button onClick={() => favoritar(g.href)} className="p-2 text-slate-300 hover:text-amber-400">
                    <Star size={14} />
                  </button>
                </div>
              ))}'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { LogOut, Menu, X, Star, ChevronUp, ChevronDown } from 'lucide-react'
import { logout, usuarioAtual } from '@/lib/auth'
import { Usuario } from '@/lib/tipos'
import { GUIAS, lerOcultos, alternarOculto, EVENTO_OCULTOS_MUDOU, guiasFavoritos, lerOrdem, ordenarPorPreferencia, moverGuia, EVENTO_ORDEM_MUDOU } from '@/lib/guias'

export default function Sidebar() {
  const pathname = usePathname()
  const router = useRouter()
  const [usuario, setUsuario] = useState<Usuario | null>(null)
  const [ocultos, setOcultos] = useState<string[]>([])
  const [ordem, setOrdem] = useState<string[]>([])
  const [abrirMais, setAbrirMais] = useState(false)

  useEffect(() => {
    usuarioAtual().then(setUsuario)
    setOcultos(lerOcultos())
    setOrdem(lerOrdem())
    function sync() {
      setOcultos(lerOcultos())
    }
    function syncOrdem() {
      setOrdem(lerOrdem())
    }
    window.addEventListener(EVENTO_OCULTOS_MUDOU, sync)
    window.addEventListener(EVENTO_ORDEM_MUDOU, syncOrdem)
    return () => {
      window.removeEventListener(EVENTO_OCULTOS_MUDOU, sync)
      window.removeEventListener(EVENTO_ORDEM_MUDOU, syncOrdem)
    }
  }, [])

  async function sair() {
    await logout()
    router.replace('/login')
  }

  const isMaster = usuario?.role === 'master'
  const favoritos = guiasFavoritos(ocultos, isMaster)
  const resto = GUIAS.filter((g) => !g.masterOnly || isMaster).filter((g) => ocultos.includes(g.href))
  const restoOrdenado = ordenarPorPreferencia(resto, ordem)

  function mover(href: string, direcao: 'cima' | 'baixo') {
    moverGuia(restoOrdenado, href, direcao)
  }

  function favoritar(href: string) {
    setOcultos(alternarOculto(href))
  }

  function removerFavorito(e: React.MouseEvent, href: string) {
    e.preventDefault()
    e.stopPropagation()
    favoritar(href)
  }

  return (
    <>
      <nav
        className="fixed bottom-0 left-0 right-0 z-40 flex items-center justify-around border-t border-slate-200 bg-white px-2 py-1.5
                   lg:static lg:h-screen lg:w-56 lg:flex-col lg:items-stretch lg:justify-start lg:gap-0 lg:border-r lg:border-t-0 lg:py-5"
      >
        <div className="hidden lg:flex lg:flex-col lg:px-3">
          <span className="mb-3 px-1 text-base font-bold tracking-tight text-brand-navy">Atlas One</span>

          {favoritos.length > 0 && (
            <div className="mb-4 space-y-0.5 px-1">
              {favoritos.map((g) => {
                const Icon = g.icon
                const ativo = pathname === g.href
                return (
                  <div key={g.href} className="group relative flex items-center">
                    <Link
                      href={g.href}
                      title={g.label}
                      className={`flex flex-1 items-center gap-2 truncate rounded-lg px-2 py-1.5 text-xs transition
                                  ${ativo ? 'bg-brand-navy text-white' : 'text-slate-600 hover:bg-slate-100'}`}
                    >
                      <Icon size={15} className="flex-shrink-0" />
                      <span className="truncate">{g.label}</span>
                    </Link>
                    <button
                      onClick={(e) => removerFavorito(e, g.href)}
                      title="Remover dos favoritos"
                      className={`absolute right-1 flex h-4 w-4 items-center justify-center rounded-full text-white opacity-0 transition hover:bg-red-500 group-hover:opacity-100
                                  ${ativo ? 'bg-white/30' : 'bg-slate-400'}`}
                    >
                      <X size={10} />
                    </button>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {resto.length > 0 && (
          <div className="hidden lg:block lg:flex-1 lg:overflow-y-auto lg:px-3">
            <p className="mb-2 px-1 text-[10px] font-semibold uppercase tracking-wide text-slate-400">Mais</p>
            <div className="space-y-0.5">
              {restoOrdenado.map((g, i) => {
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
                    {i > 0 && (
                      <button
                        onClick={() => mover(g.href, 'cima')}
                        title="Mover para cima"
                        className="p-1 text-slate-300 opacity-0 hover:text-brand-navy group-hover:opacity-100"
                      >
                        <ChevronUp size={12} />
                      </button>
                    )}
                    {i < restoOrdenado.length - 1 && (
                      <button
                        onClick={() => mover(g.href, 'baixo')}
                        title="Mover para baixo"
                        className="p-1 text-slate-300 opacity-0 hover:text-brand-navy group-hover:opacity-100"
                      >
                        <ChevronDown size={12} />
                      </button>
                    )}
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

        {favoritos.map((g) => {
          const Icon = g.icon
          const ativo = pathname === g.href
          return (
            <div key={g.href} className="group relative lg:hidden">
              <Link
                href={g.href}
                title={g.label}
                className={`flex h-14 w-14 flex-col items-center justify-center gap-1 rounded-xl transition
                            ${ativo ? 'bg-brand-navy text-white' : 'text-slate-500 hover:bg-slate-100'}`}
              >
                <Icon size={20} />
                <span className="text-[10px] leading-none">{g.label}</span>
              </Link>
              <button
                onClick={(e) => removerFavorito(e, g.href)}
                title="Remover dos favoritos"
                className="absolute right-1 top-0 flex h-4 w-4 items-center justify-center rounded-full bg-slate-400 text-white active:bg-red-500"
              >
                <X size={10} />
              </button>
            </div>
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
