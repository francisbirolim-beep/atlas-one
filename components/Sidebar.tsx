'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import {
  Bot,
  Eye,
  ChevronDown,
  ChevronRight,
  LogOut,
  Moon,
  Search,
  Settings,
  Store,
  Sun,
} from 'lucide-react'
import { logout, usuarioAtual } from '@/lib/auth'
import type { Usuario } from '@/lib/tipos'
import { agruparGuias, GUIAS } from '@/lib/guias'
import { ITENS_ADMIN } from '@/lib/navegacaoAdmin'
import { ATALHOS_PESQUISA_ATLAS, correspondePesquisaAtlas } from '@/lib/navegacaoPesquisa'

type TemaAtlas = 'escuro' | 'claro'

function normalizar(texto: string) {
  return texto.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim()
}

export default function Sidebar() {
  const pathname = usePathname()
  const router = useRouter()
  const [usuario, setUsuario] = useState<Usuario | null>(null)
  const [tema, setTema] = useState<TemaAtlas>('escuro')
  const [busca, setBusca] = useState('')
  const [adminAberto, setAdminAberto] = useState(false)
  const [gruposAbertos, setGruposAbertos] = useState<Record<string, boolean>>({})

  useEffect(() => { usuarioAtual().then(setUsuario) }, [])

  useEffect(() => {
    if (!usuario?.id) return
    const salvo = window.localStorage.getItem(`atlas-theme:${usuario.id}`)
    const temaInicial: TemaAtlas = salvo === 'claro' ? 'claro' : 'escuro'
    setTema(temaInicial)
    document.documentElement.dataset.atlasTheme = temaInicial
    document.documentElement.style.colorScheme = temaInicial === 'escuro' ? 'dark' : 'light'
  }, [usuario?.id])

  useEffect(() => {
    const grupoAtivo = GUIAS
      .filter(g => g.grupo !== 'Geral')
      .filter(g => pathname === g.href || pathname.startsWith(`${g.href}/`))
      .sort((a, b) => b.href.length - a.href.length)[0]?.grupo
    if (grupoAtivo) setGruposAbertos(prev => ({ ...prev, [grupoAtivo]: true }))
    const emAdministracao = ITENS_ADMIN.some(item => pathname === item.href || pathname.startsWith(`${item.href}/`))
    if (emAdministracao) setAdminAberto(true)
  }, [pathname])

  async function sair() {
    await logout()
    router.replace('/login')
  }

  function alternarTema() {
    const proximo: TemaAtlas = tema === 'escuro' ? 'claro' : 'escuro'
    setTema(proximo)
    document.documentElement.dataset.atlasTheme = proximo
    document.documentElement.style.colorScheme = proximo === 'escuro' ? 'dark' : 'light'
    if (usuario?.id) window.localStorage.setItem(`atlas-theme:${usuario.id}`, proximo)
  }

  const hrefGuiaAtiva = useMemo(() => GUIAS
    .filter(g => pathname === g.href || (g.href !== '/' && pathname.startsWith(`${g.href}/`)))
    .sort((a, b) => b.href.length - a.href.length)[0]?.href, [pathname])

  function ativo(href: string) {
    if (hrefGuiaAtiva) return hrefGuiaAtiva === href
    if (href === '/') return pathname === '/'
    return pathname === href || pathname.startsWith(`${href}/`)
  }

  const termo = normalizar(busca)
  const gruposVisiveis = useMemo(() => {
    const permitidas = GUIAS.filter(guia => !guia.masterOnly || usuario?.role === 'master')
    const filtradas = (termo
      ? permitidas.filter(guia => correspondePesquisaAtlas(termo, guia.label, guia.grupo, guia.href))
      : permitidas
    ).filter(guia => guia.grupo !== 'Geral')
    return agruparGuias(filtradas)
  }, [termo, usuario?.role])

  const adminVisiveis = useMemo(() => {
    if (!termo) return ITENS_ADMIN
    return ITENS_ADMIN.filter(item => correspondePesquisaAtlas(termo, item.label, item.descricao, item.palavras, item.href))
  }, [termo])

  const atalhosVisiveis = useMemo(() => {
    if (!termo) return []
    const ocupados = new Set([...GUIAS.map(item => item.href), ...ITENS_ADMIN.map(item => item.href)])
    return ATALHOS_PESQUISA_ATLAS
      .filter(item => (!item.masterOnly || usuario?.role === 'master'))
      .filter(item => !ocupados.has(item.href))
      .filter(item => correspondePesquisaAtlas(termo, item.label, item.grupo, item.descricao, item.palavras, item.href))
      .slice(0, 18)
  }, [termo, usuario?.role])

  const inicioCombina = !termo || correspondePesquisaAtlas(termo, 'Início', 'Geral', '/')
  const balcaoCombina = !termo || correspondePesquisaAtlas(termo, 'Venda Balcão', 'Geral', '/balcao')
  const iaCombina = !termo || correspondePesquisaAtlas(termo, 'IA Atlas', 'Inteligência Artificial', '/atlas-ia')
  const supervisaoIaCombina = usuario?.role === 'master' && (!termo || correspondePesquisaAtlas(termo, 'Supervisão da IA', 'Inteligência Artificial', '/atlas-ia/supervisao'))
  const mostrarAdmin = usuario?.role === 'master' && (adminAberto || !!termo)
  const semResultados = !inicioCombina && !balcaoCombina && !iaCombina && !supervisaoIaCombina
    && gruposVisiveis.length === 0
    && atalhosVisiveis.length === 0
    && (!usuario || usuario.role !== 'master' || adminVisiveis.length === 0)

  return (
    <nav className="atlas-sidebar-nav hidden h-screen w-60 flex-shrink-0 flex-col overflow-hidden border-r border-slate-200 bg-white px-3 py-5 md:flex">
      <div className="atlas-sidebar-brand flex items-center gap-3 px-2 pb-5">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-600 text-lg font-bold text-white shadow-lg shadow-blue-950/20">A</span>
        <span className="min-w-0">
          <strong className="block text-sm font-bold uppercase tracking-[0.08em] text-slate-900">Atlas One</strong>
          <span className="mt-0.5 block truncate text-[11px] text-slate-400">Esquadrifácio</span>
        </span>
      </div>

      <div className="mb-4 px-1">
        <div className="relative">
          <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input value={busca} onChange={e => setBusca(e.target.value)} placeholder="Buscar tela ou setor..." className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2.5 pl-9 pr-3 text-sm text-slate-700 outline-none transition placeholder:text-slate-400 focus:border-emerald-400 focus:bg-white focus:ring-2 focus:ring-emerald-100" />
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto pr-1">
        <div className="space-y-1">
          {inicioCombina && (
            <Link href="/" className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition ${ativo('/') ? 'bg-brand-navy text-white shadow-sm' : 'text-slate-700 hover:bg-slate-100'}`}>
              <span className="text-lg leading-none">⌂</span><span>Início</span>
            </Link>
          )}

          {balcaoCombina && (
            <Link href="/balcao" className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition ${ativo('/balcao') ? 'bg-brand-navy text-white shadow-sm' : 'text-slate-700 hover:bg-slate-100'}`}>
              <Store size={18} className="shrink-0" /><span>Venda Balcão</span>
            </Link>
          )}

          {iaCombina && (
            <Link href="/atlas-ia" className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition ${ativo('/atlas-ia') ? 'bg-brand-navy text-white shadow-sm' : 'text-slate-700 hover:bg-slate-100'}`}>
              <Bot size={18} className="shrink-0" /><span>IA Atlas</span>
            </Link>
          )}

          {supervisaoIaCombina && (
            <Link href="/atlas-ia/supervisao" className={`ml-3 flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition ${ativo('/atlas-ia/supervisao') ? 'bg-brand-navy text-white shadow-sm' : 'text-slate-600 hover:bg-slate-100'}`}>
              <Eye size={17} className="shrink-0" /><span>Supervisão da IA</span>
            </Link>
          )}

          <div className="my-3 border-t border-slate-100" />

          {gruposVisiveis.map(grupo => {
            const aberto = !!termo || !!gruposAbertos[grupo.grupo]
            return (
              <section key={grupo.grupo}>
                <button type="button" aria-expanded={aberto} onClick={() => setGruposAbertos(prev => ({ ...prev, [grupo.grupo]: !prev[grupo.grupo] }))} className="flex w-full items-center justify-between rounded-xl px-3 py-2 text-left text-xs font-semibold uppercase tracking-[0.14em] text-slate-500 transition hover:bg-slate-50 hover:text-slate-800">
                  <span>{grupo.grupo}</span>{aberto ? <ChevronDown size={15}/> : <ChevronRight size={15}/>}
                </button>
                {aberto && (
                  <div className="mb-2 mt-1 space-y-1">
                    {grupo.itens.map(guia => {
                      const Icon = guia.icon
                      const selecionado = ativo(guia.href)
                      return (
                        <Link key={guia.href} href={guia.href} className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition ${selecionado ? 'bg-brand-navy text-white shadow-sm' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'}`}>
                          <Icon size={17} className="shrink-0" /><span>{guia.label}</span>
                        </Link>
                      )
                    })}
                  </div>
                )}
              </section>
            )
          })}

          {atalhosVisiveis.length > 0 && (
            <section className="pt-2">
              <p className="mb-1.5 px-3 text-[10px] font-semibold uppercase tracking-[0.16em] text-emerald-500">Outras telas</p>
              {atalhosVisiveis.map(item => (
                <Link key={item.href} href={item.href} title={item.descricao} onClick={() => setBusca('')} className="group flex items-start gap-3 rounded-xl px-3 py-2.5 text-slate-500 transition hover:bg-slate-50 hover:text-slate-800">
                  <Search size={17} className="mt-0.5 shrink-0 text-emerald-500" />
                  <span className="min-w-0"><span className="block text-sm font-medium leading-5">{item.label}</span><span className="mt-0.5 block truncate text-[10px] leading-4 text-slate-400">{item.grupo} · {item.descricao}</span></span>
                </Link>
              ))}
            </section>
          )}

          {usuario?.role === 'master' && (
            <section className="mt-3 border-t border-slate-100 pt-3">
              <button type="button" onClick={() => setAdminAberto(v => !v)} aria-expanded={mostrarAdmin} className="flex w-full items-center justify-between rounded-xl px-3 py-2 text-left text-xs font-semibold uppercase tracking-[0.14em] text-slate-500 transition hover:bg-slate-50 hover:text-slate-800">
                <span className="inline-flex items-center gap-2"><Settings size={15}/> Administração</span>{mostrarAdmin ? <ChevronDown size={15}/> : <ChevronRight size={15}/>}
              </button>
              {mostrarAdmin && <div className="mt-1 space-y-1">{adminVisiveis.map(item => {
                const Icon = item.icon
                return <Link key={item.href} href={item.href} title={item.descricao} className={`group flex items-start gap-3 rounded-xl px-3 py-2.5 transition ${ativo(item.href) ? 'bg-slate-100 text-brand-navy' : 'text-slate-500 hover:bg-slate-50 hover:text-slate-800'}`}><Icon size={17} className="mt-0.5 shrink-0"/><span className="min-w-0"><span className="block text-sm font-medium leading-5">{item.label}</span><span className="mt-0.5 block text-[10px] leading-4 text-slate-400">{item.descricao}</span></span></Link>
              })}</div>}
            </section>
          )}

          {semResultados && <div className="rounded-xl border border-dashed border-slate-200 px-3 py-4 text-center text-xs text-slate-400">Nenhuma opção encontrada para “{busca}”.</div>}
        </div>
      </div>

      <div className="mt-4 border-t border-slate-100 pt-4">
        <div className="mb-3 px-3"><p className="truncate text-xs font-semibold text-slate-700">{usuario?.nome || 'Usuário'}</p><p className="text-[10px] uppercase tracking-wide text-slate-400">{usuario?.role || ''}</p></div>
        <button type="button" onClick={alternarTema} className="atlas-theme-toggle mb-1 flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-slate-500 transition hover:bg-slate-100 hover:text-slate-800" title={tema === 'escuro' ? 'Usar tema claro' : 'Usar tema escuro'}>
          {tema === 'escuro' ? <Sun size={17}/> : <Moon size={17}/>} {tema === 'escuro' ? 'Tema claro' : 'Tema escuro'}
        </button>
        <button type="button" onClick={sair} className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-slate-500 transition hover:bg-red-50 hover:text-red-600"><LogOut size={17}/> Sair</button>
      </div>
    </nav>
  )
}
