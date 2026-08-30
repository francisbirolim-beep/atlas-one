'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  Columns3,
  Home,
  LayoutGrid,
  Menu,
  Search,
  ShoppingCart,
  Star,
  X,
} from 'lucide-react'
import { usuarioAtual } from '@/lib/auth'
import {
  EVENTO_ABRIR_FAVORITOS_MOBILE,
  GUIAS,
  agruparGuias,
} from '@/lib/guias'
import { listarPermissoesUsuario, listarSetores, nivelEfetivo } from '@/lib/setores'
import { ITENS_ADMIN } from '@/lib/navegacaoAdmin'
import type { Guia } from '@/lib/guias'
import type { NivelPermissao, Setor, Usuario } from '@/lib/tipos'

function normalizar(texto: string) {
  return texto
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
}

function rotasRelacionadas(rotaGuia: string, rotaSetor: string) {
  if (rotaGuia === '/' || rotaSetor === '/') return rotaGuia === rotaSetor
  return rotaGuia === rotaSetor
    || rotaGuia.startsWith(`${rotaSetor}/`)
    || rotaSetor.startsWith(`${rotaGuia}/`)
}

function hrefSetor(setor: Setor) {
  return setor.ativo && setor.rota ? setor.rota : `/setor/${setor.id}`
}

export default function MobileNavigationControls() {
  const pathname = usePathname()
  const [menuAberto, setMenuAberto] = useState(false)
  const [busca, setBusca] = useState('')
  const [usuario, setUsuario] = useState<Usuario | null>(null)
  const [setores, setSetores] = useState<Setor[]>([])
  const [permissoes, setPermissoes] = useState<Record<string, NivelPermissao>>({})

  useEffect(() => {
    let ativo = true

    async function carregarNavegacao() {
      const [usuarioLogado, setoresCadastrados] = await Promise.all([
        usuarioAtual(),
        listarSetores(),
      ])
      if (!ativo) return

      setUsuario(usuarioLogado)
      setSetores(setoresCadastrados)

      if (usuarioLogado && usuarioLogado.role !== 'master') {
        const mapa = await listarPermissoesUsuario(usuarioLogado.id)
        if (ativo) setPermissoes(mapa)
      }
    }

    void carregarNavegacao()
    return () => { ativo = false }
  }, [])

  useEffect(() => {
    if (!menuAberto) return
    const overflowAnterior = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const fecharComEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setMenuAberto(false)
    }
    window.addEventListener('keydown', fecharComEscape)
    return () => {
      document.body.style.overflow = overflowAnterior
      window.removeEventListener('keydown', fecharComEscape)
    }
  }, [menuAberto])

  function ativo(href: string) {
    if (href === '/') return pathname === '/'
    return pathname === href || pathname.startsWith(`${href}/`)
  }

  function abrirFavoritos() {
    setMenuAberto(false)
    window.dispatchEvent(new Event(EVENTO_ABRIR_FAVORITOS_MOBILE))
  }

  function fecharMenu() {
    setMenuAberto(false)
    setBusca('')
  }

  const guiasPermitidas = useMemo(() => {
    if (!usuario) return GUIAS.filter(guia => !guia.masterOnly)
    if (usuario.role === 'master') return GUIAS

    return GUIAS.filter(guia => {
      if (guia.masterOnly) return false
      if (guia.href === '/') return true
      const setor = setores.find(item => item.rota && rotasRelacionadas(guia.href, item.rota))
      return !setor || nivelEfetivo(usuario, setor.id, permissoes) !== 'oculto'
    })
  }, [permissoes, setores, usuario])

  const termo = normalizar(busca)
  const gruposVisiveis = useMemo(() => {
    const filtradas = termo
      ? guiasPermitidas.filter(guia => normalizar(`${guia.label} ${guia.grupo}`).includes(termo))
      : guiasPermitidas
    return agruparGuias(filtradas)
  }, [guiasPermitidas, termo])

  const hrefsGuias = useMemo(() => new Set(GUIAS.map(guia => guia.href)), [])
  const setoresExtras = useMemo(() => setores.filter(setor => {
    if (!setor.ativo || !setor.rota || hrefsGuias.has(setor.rota)) return false
    if (usuario?.role !== 'master' && nivelEfetivo(usuario, setor.id, permissoes) === 'oculto') return false
    return !termo || normalizar(`${setor.nome} ${setor.grupo} ${setor.descricao || ''}`).includes(termo)
  }), [hrefsGuias, permissoes, setores, termo, usuario])

  const adminVisiveis = useMemo(() => {
    if (usuario?.role !== 'master') return []
    if (!termo) return ITENS_ADMIN
    return ITENS_ADMIN.filter(item => normalizar(`${item.label} ${item.descricao} ${item.palavras}`).includes(termo))
  }, [termo, usuario?.role])

  const podeAbrirKanban = guiasPermitidas.some(guia => guia.href === '/kanban')
  const podeAbrirCompras = guiasPermitidas.some(guia => guia.href === '/compras')

  const itemBarra = (href: string, label: string, Icon: typeof Home) => {
    const selecionado = ativo(href)
    return (
      <Link
        href={href}
        aria-current={selecionado ? 'page' : undefined}
        className={`flex min-w-0 flex-1 flex-col items-center justify-center gap-0.5 rounded-xl py-1.5 text-[10px] font-semibold transition ${
          selecionado ? 'bg-blue-50 text-blue-700' : 'text-slate-500 active:bg-slate-100'
        }`}
      >
        <Icon size={20} strokeWidth={selecionado ? 2.4 : 2} />
        <span className="truncate">{label}</span>
      </Link>
    )
  }

  const linkMenu = (guia: Guia) => {
    const Icon = guia.icon
    const selecionado = ativo(guia.href)
    return (
      <Link
        key={guia.href}
        href={guia.href}
        onClick={fecharMenu}
        aria-current={selecionado ? 'page' : undefined}
        className={`flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-semibold transition ${
          selecionado ? 'bg-blue-600 text-white' : 'text-slate-600 active:bg-slate-100'
        }`}
      >
        <Icon size={19} className="shrink-0" />
        <span>{guia.label}</span>
      </Link>
    )
  }

  return (
    <>
      <nav
        aria-label="Navegação principal no celular"
        className="fixed inset-x-0 bottom-0 z-[60] border-t border-slate-200 bg-white/95 px-2 pb-[max(0.35rem,env(safe-area-inset-bottom))] pt-1 shadow-[0_-8px_24px_rgba(15,23,42,0.08)] backdrop-blur-xl print:hidden md:hidden"
      >
        <div className="mx-auto flex max-w-lg items-stretch gap-1">
          {itemBarra('/', 'Início', Home)}
          {podeAbrirKanban && itemBarra('/kanban', 'Kanban', Columns3)}
          {podeAbrirCompras && itemBarra('/compras', 'Compras', ShoppingCart)}
          <button
            type="button"
            onClick={abrirFavoritos}
            className="flex min-w-0 flex-1 flex-col items-center justify-center gap-0.5 rounded-xl py-1.5 text-[10px] font-semibold text-slate-500 transition active:bg-slate-100"
            aria-label="Abrir favoritos"
          >
            <Star size={20} />
            <span className="truncate">Favoritos</span>
          </button>
          <button
            type="button"
            onClick={() => setMenuAberto(true)}
            className={`flex min-w-0 flex-1 flex-col items-center justify-center gap-0.5 rounded-xl py-1.5 text-[10px] font-semibold transition ${
              menuAberto ? 'bg-blue-50 text-blue-700' : 'text-slate-500 active:bg-slate-100'
            }`}
            aria-label="Abrir menu completo"
            aria-expanded={menuAberto}
          >
            <Menu size={20} />
            <span className="truncate">Menu</span>
          </button>
        </div>
      </nav>

      {menuAberto && (
        <div
          className="fixed inset-0 z-[95] bg-slate-950/50 backdrop-blur-[2px] print:hidden md:hidden"
          onMouseDown={event => { if (event.currentTarget === event.target) fecharMenu() }}
        >
          <aside
            className="flex h-full w-[88%] max-w-sm flex-col border-r border-white/10 bg-slate-950 text-white shadow-2xl"
            aria-label="Menu completo do Atlas"
          >
            <div className="flex items-center justify-between border-b border-white/10 px-4 pb-4 pt-[max(1rem,env(safe-area-inset-top))]">
              <div className="flex min-w-0 items-center gap-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-600 text-lg font-bold">A</span>
                <span className="min-w-0">
                  <strong className="block text-sm font-bold uppercase tracking-[0.08em]">Atlas One</strong>
                  <span className="block truncate text-[11px] text-slate-400">Esquadrifácio</span>
                </span>
              </div>
              <button
                type="button"
                onClick={fecharMenu}
                className="rounded-xl border border-white/10 bg-white/5 p-2.5 text-slate-300 active:bg-white/10"
                aria-label="Fechar menu"
              >
                <X size={20} />
              </button>
            </div>

            <div className="px-4 py-3">
              <label className="relative block">
                <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                <span className="sr-only">Buscar no menu</span>
                <input
                  value={busca}
                  onChange={event => setBusca(event.target.value)}
                  placeholder="Buscar no menu..."
                  className="w-full rounded-xl border border-white/10 bg-white/5 py-2.5 pl-9 pr-3 text-sm text-white outline-none placeholder:text-slate-500 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
                />
              </label>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto px-3 pb-4">
              <div className="space-y-5">
                {gruposVisiveis.map(grupo => (
                  <section key={grupo.grupo}>
                    <p className="mb-1.5 px-3 text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500">{grupo.grupo}</p>
                    <div className="space-y-1">{grupo.itens.map(linkMenu)}</div>
                  </section>
                ))}

                {setoresExtras.length > 0 && (
                  <section>
                    <p className="mb-1.5 px-3 text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500">Outros setores</p>
                    <div className="space-y-1">
                      {setoresExtras.map(setor => (
                        <Link
                          key={setor.id}
                          href={hrefSetor(setor)}
                          onClick={fecharMenu}
                          className="flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-semibold text-slate-300 active:bg-white/10"
                        >
                          <LayoutGrid size={19} className="shrink-0" />
                          <span>{setor.nome}</span>
                        </Link>
                      ))}
                    </div>
                  </section>
                )}

                {adminVisiveis.length > 0 && (
                  <section className="border-t border-white/10 pt-4">
                    <p className="mb-1.5 px-3 text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500">Administração</p>
                    <div className="space-y-1">
                      {adminVisiveis.map(item => {
                        const Icon = item.icon
                        return (
                          <Link
                            key={item.href}
                            href={item.href}
                            onClick={fecharMenu}
                            className="flex items-start gap-3 rounded-xl px-3 py-3 text-slate-300 active:bg-white/10"
                          >
                            <Icon size={18} className="mt-0.5 shrink-0" />
                            <span className="min-w-0">
                              <span className="block text-sm font-semibold leading-5">{item.label}</span>
                              <span className="block text-[10px] leading-4 text-slate-500">{item.descricao}</span>
                            </span>
                          </Link>
                        )
                      })}
                    </div>
                  </section>
                )}

                {gruposVisiveis.length === 0 && setoresExtras.length === 0 && adminVisiveis.length === 0 && (
                  <div className="mx-2 rounded-xl border border-dashed border-white/15 px-4 py-6 text-center text-sm text-slate-500">
                    Nenhuma opção encontrada para “{busca}”.
                  </div>
                )}
              </div>
            </div>

            <div className="border-t border-white/10 px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3">
              <p className="truncate text-xs font-semibold text-white">{usuario?.nome || 'Usuário'}</p>
              <p className="mt-0.5 text-[10px] uppercase tracking-wide text-slate-500">{usuario?.role === 'master' ? 'Acesso total' : 'Acesso por setor'}</p>
            </div>
          </aside>
        </div>
      )}
    </>
  )
}
