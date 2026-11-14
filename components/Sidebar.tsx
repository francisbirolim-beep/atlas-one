'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import {
  Bot,
  BarChart3,
  Columns3,
  Home,
  ReceiptText,
  BookOpen,
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
import { logout, usuarioAtual, usuarioCacheLocal } from '@/lib/auth'
import type { Usuario, Setor, NivelPermissao } from '@/lib/tipos'
import { listarPermissoesUsuario, listarSetores, nivelEfetivo } from '@/lib/setores'
import { podeAcessarRotaCatalogada } from '@/lib/permissoesRota'
import { lerAcessoUsuarioConfig, type AcessoUsuarioConfig } from '@/lib/acessoUsuario'
import { podeExecutarAcao, permissaoDaRotaProducao } from '@/lib/producaoPermissoes'
import { carregarAcessoCadastro, podeAcaoCadastro } from '@/lib/acessoCadastroOperacional'
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
  const [usuario, setUsuario] = useState<Usuario | null>(() => usuarioCacheLocal())
  const [setoresAcesso, setSetoresAcesso] = useState<Setor[]>([])
  const [permissoesAcesso, setPermissoesAcesso] = useState<Record<string,NivelPermissao>>({})
  const [configAcesso, setConfigAcesso] = useState<AcessoUsuarioConfig | null>(null)
  const [acessoCarregado, setAcessoCarregado] = useState(false)
  const [tema, setTema] = useState<TemaAtlas>('escuro')
  const [podeLancarNF, setPodeLancarNF] = useState(false)
  const [podeReceberManual, setPodeReceberManual] = useState(false)
  const [podeVerCadastros, setPodeVerCadastros] = useState(false)
  const [podeAcessarCRM, setPodeAcessarCRM] = useState(false)
  const [busca, setBusca] = useState('')
  const [adminAberto, setAdminAberto] = useState(false)
  const [gruposAbertos, setGruposAbertos] = useState<Record<string, boolean>>({})

  useEffect(() => { void usuarioAtual().then(u => { if (u) setUsuario(u) }) }, [])

  // Na navegação desktop, ocultar também o item do menu — não apenas a página.
  useEffect(() => {
    let ativo = true
    setAcessoCarregado(false)
    if (!usuario?.id || usuario.role === 'master') {
      setAcessoCarregado(true)
      return () => { ativo = false }
    }
    void Promise.all([
      listarSetores(), listarPermissoesUsuario(usuario.id), lerAcessoUsuarioConfig(usuario),
    ]).then(([setores, permissoes, config]) => {
      if (!ativo) return
      setSetoresAcesso(setores)
      setPermissoesAcesso(permissoes)
      setConfigAcesso(config)
      setAcessoCarregado(true)
    }).catch(() => { if (ativo) setAcessoCarregado(false) })
    return () => { ativo = false }
  }, [usuario?.id, usuario?.role])

  // O acesso ao CRM no menu respeita o setor autorizado; nunca exibir a um funcionário oculto.
  useEffect(() => {
    if (!usuario?.id) { setPodeAcessarCRM(false); return }
    if (usuario.role === 'master') { setPodeAcessarCRM(true); return }
    let ativo = true
    void listarPermissoesUsuario(usuario.id)
      .then(setores => { if (ativo) setPodeAcessarCRM(setores.crm === 'consulta' || setores.crm === 'edicao') })
      .catch(() => { if (ativo) setPodeAcessarCRM(false) })
    return () => { ativo = false }
  }, [usuario?.id, usuario?.role])

  // Atalho operacional: apenas quem recebeu do Master edição em NF/compras.
  // Mantém o menu do Master exatamente como era.
  useEffect(() => {
    if (!usuario?.id) { setPodeVerCadastros(false); return }
    let ativo = true
    void carregarAcessoCadastro(usuario).then(acesso => {
      if (ativo) setPodeVerCadastros(acesso.usuario?.role === 'master' || (acesso.nivel !== 'oculto' &&
        (['clientes','produtos','linhas','materiais','fornecedores','catalogo_tecnico','historico','produtos_linha','precificacao','unidades','receitas','formulas','campos'] as const).some(id => podeAcaoCadastro(acesso,id))))
    }).catch(() => { if (ativo) setPodeVerCadastros(false) })
    return () => { ativo = false }
  }, [usuario?.id, usuario?.role])

  useEffect(() => {
    if (!usuario?.id || usuario.role === 'master') { setPodeLancarNF(false); return }
    let ativo = true
    void Promise.all([listarPermissoesUsuario(usuario.id), lerAcessoUsuarioConfig(usuario)])
      .then(([setores, acesso]) => {
        const especifica = acesso.acoes?.['compras.notas.lancar']
        if (ativo) setPodeLancarNF(setores.compras === 'edicao' && (!especifica || especifica === 'edicao'))
      })
      .catch(() => { if (ativo) setPodeLancarNF(false) })
    return () => { ativo = false }
  }, [usuario?.id, usuario?.role])

  // Nova entrada por romaneio: usar apenas a permissão de receber mercadoria.
  // Não muda a autorização existente da entrada de NF.
  useEffect(() => {
    if (!usuario?.id) { setPodeReceberManual(false); return }
    if (usuario.role === 'master') { setPodeReceberManual(true); return }
    let ativo = true
    void Promise.all([listarPermissoesUsuario(usuario.id), lerAcessoUsuarioConfig(usuario)])
      .then(([setores, acesso]) => {
        const especifica = acesso.acoes?.['compras.recebimento.receber']
        if (ativo) setPodeReceberManual(setores.recebimento === 'edicao' && (!especifica || especifica === 'edicao'))
      })
      .catch(() => { if (ativo) setPodeReceberManual(false) })
    return () => { ativo = false }
  }, [usuario?.id, usuario?.role])

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
    if (pathname === '/balcao' || pathname.startsWith('/balcao/')) setGruposAbertos(prev => ({...prev, Comercial:true}))
    if (pathname === '/kanban' || pathname.startsWith('/kanban/') || pathname === '/tarefas') setGruposAbertos(prev => ({...prev, Kanban:true}))
    if (pathname === '/relatorios' || pathname.startsWith('/relatorios/')) setGruposAbertos(prev => ({...prev, 'Relatórios':true}))
    if (pathname === '/atlas-ia' || pathname.startsWith('/atlas-ia/')) setGruposAbertos(prev => ({...prev, 'IA Atlas':true}))
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
  function guiaLiberada(href: string) {
    if (usuario?.role === 'master') return true
    // Evita exibir módulos da Produção durante a consulta e após uma negativa.
    const producao = permissaoDaRotaProducao(href)
    if (producao) {
      return acessoCarregado && configAcesso !== null &&
        podeExecutarAcao(usuario?.role || '', permissoesAcesso, configAcesso, producao.setor, producao.acao)
    }
    // Nunca exibir links protegidos enquanto ainda não temos autorizações.
    if (!acessoCarregado || !configAcesso) return false
    const permitido=podeAcessarRotaCatalogada(href,usuario?.role||'',permissoesAcesso,configAcesso,setoresAcesso)
    if(permitido!==null)return permitido
    const setor = setoresAcesso
      .filter(item => item.ativo && item.rota && (href === item.rota || href.startsWith(item.rota + '/')))
      .sort((a,b) => (b.rota?.length || 0) - (a.rota?.length || 0))[0]
    return !setor || nivelEfetivo(usuario, setor.id, permissoesAcesso) !== 'oculto'
  }
  const gruposVisiveis = useMemo(() => {
    const permitidas = GUIAS.filter(guia => (!guia.masterOnly || usuario?.role === 'master') && (guia.href !== '/cadastros' || podeVerCadastros) && (guia.href !== '/crm/comercial' || podeAcessarCRM) && (guia.href !== '/compras/entrada-manual' || podeReceberManual) && guiaLiberada(guia.href))
    const filtradas = (termo
      ? permitidas.filter(guia => correspondePesquisaAtlas(termo, guia.label, guia.grupo, guia.href))
      : permitidas
    ).filter(guia => guia.grupo !== 'Geral')
    return agruparGuias(filtradas)
  }, [termo, usuario, podeVerCadastros, podeReceberManual, podeAcessarCRM, acessoCarregado, permissoesAcesso, configAcesso, setoresAcesso])

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
  }, [termo, usuario?.role, podeVerCadastros])

  const inicioCombina = !termo || correspondePesquisaAtlas(termo, 'Início', 'Geral', '/')
  const balcaoCombina = !termo || correspondePesquisaAtlas(termo, 'Venda Balcão', 'Geral', '/balcao')
  const entradaNfCombina = podeLancarNF && (!termo || correspondePesquisaAtlas(termo, 'Entrada de Nota Fiscal', 'Compras', '/compras/entrada'))
  const relatoriosCombina = !termo || correspondePesquisaAtlas(termo, 'Relatórios', 'Geral', '/relatorios')
  const consultoriaCombina = usuario?.role === 'master' && (!termo || correspondePesquisaAtlas(termo, 'Esquadrifácio', 'Relatórios gerenciais', '/relatorios/esquadrifacio'))
  const iaCombina = !termo || correspondePesquisaAtlas(termo, 'IA Atlas', 'Inteligência Artificial', '/atlas-ia')
  const supervisaoIaCombina = usuario?.role === 'master' && (!termo || correspondePesquisaAtlas(termo, 'Supervisão da IA', 'Inteligência Artificial', '/atlas-ia/supervisao'))
  // O Kanban tem um acesso próprio, mas cada item preserva a permissão da rota original.
  const kanbanComercialCombina = guiaLiberada('/kanban') &&
    (!termo || correspondePesquisaAtlas(termo,'Kanban Comercial','Kanban','/kanban'))
  const kanbanPessoalCombina = (usuario?.role === 'master' || guiaLiberada('/tarefas')) &&
    (!termo || correspondePesquisaAtlas(termo,'Kanban Pessoal','Minhas tarefas','/tarefas'))
  const kanbanGeralCombina = guiaLiberada('/producao') &&
    (!termo || correspondePesquisaAtlas(termo,'Kanban Geral','Produção','/producao'))
  const kanbanCombina = kanbanComercialCombina || kanbanPessoalCombina || kanbanGeralCombina

  // Vendas e Entrada de NF deixam de ocupar botões soltos, sem perder acesso.
  // O mesmo link não é repetido no submenu caso já exista no grupo original.
  const gruposNavegacao = useMemo(() => {
    const grupos = gruposVisiveis.map(grupo => ({
      ...grupo,
      itens: grupo.itens.filter(guia => guia.href !== '/kanban'),
    }))
    if (balcaoCombina && !grupos.some(grupo => grupo.grupo === 'Comercial'))
      grupos.unshift({grupo:'Comercial', itens:[]})
    if (entradaNfCombina && !grupos.some(grupo => grupo.grupo === 'Compras'))
      grupos.push({grupo:'Compras', itens:[]})
    return grupos.filter(grupo => grupo.itens.length > 0 ||
      (grupo.grupo === 'Comercial' && balcaoCombina) ||
      (grupo.grupo === 'Compras' && entradaNfCombina))
  }, [gruposVisiveis, balcaoCombina, entradaNfCombina])

  const mostrarAdmin = usuario?.role === 'master' && (adminAberto || !!termo)
  const semResultados = !inicioCombina && !balcaoCombina && !entradaNfCombina && !relatoriosCombina && !consultoriaCombina && !iaCombina && !supervisaoIaCombina
    && gruposVisiveis.length === 0 && !kanbanCombina
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
            <Link href="/" title="Voltar ao Início" className={`mb-2 flex items-center gap-3 rounded-xl px-3 py-3.5 text-base font-bold transition ${ativo('/') ? 'bg-brand-navy text-white shadow-sm' : 'text-slate-700 hover:bg-slate-100'}`}>
              <Home size={20} className="shrink-0" /><span>Início</span>
            </Link>
          )}

          {kanbanCombina && (
            <section>
              <button type="button" aria-expanded={!!termo || !!gruposAbertos.Kanban}
                onClick={() => setGruposAbertos(prev => ({...prev,Kanban:!prev.Kanban}))}
                className="flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-[13px] font-semibold text-slate-600 transition hover:bg-slate-50 hover:text-slate-800">
                <span className="flex items-center gap-2"><Columns3 size={16}/><span>Kanban</span></span>
                {(!!termo || !!gruposAbertos.Kanban) ? <ChevronDown size={15}/> : <ChevronRight size={15}/>}
              </button>
              {(!!termo || !!gruposAbertos.Kanban) && <div className="ml-3 space-y-0.5 border-l border-slate-200 pl-2">
                {kanbanComercialCombina && <Link href="/kanban" className={`flex items-center gap-2 rounded-lg px-2.5 py-2 text-[13px] ${ativo('/kanban')?'bg-brand-navy font-semibold text-white':'text-slate-600 hover:bg-slate-100'}`}><Columns3 size={15}/> Kanban Comercial</Link>}
                {kanbanPessoalCombina && <Link href="/#kanban-pessoal" className="flex items-center gap-2 rounded-lg px-2.5 py-2 text-[13px] text-slate-600 hover:bg-slate-100"><Columns3 size={15}/> Kanban Pessoal</Link>}
                {kanbanGeralCombina && <Link href="/producao" className={`flex items-center gap-2 rounded-lg px-2.5 py-2 text-[13px] ${ativo('/producao')?'bg-brand-navy font-semibold text-white':'text-slate-600 hover:bg-slate-100'}`}><Columns3 size={15}/> Kanban Geral</Link>}
              </div>}
            </section>
          )}

          {gruposNavegacao.map(grupo => {
            const aberto = !!termo || !!gruposAbertos[grupo.grupo]
            return (
              <section key={grupo.grupo}>
                <button type="button" aria-expanded={aberto} onClick={() => setGruposAbertos(prev => ({ ...prev, [grupo.grupo]: !prev[grupo.grupo] }))}
                  className="flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-[13px] font-semibold normal-case tracking-normal text-slate-600 transition hover:bg-slate-50 hover:text-slate-800">
                  <span>{grupo.grupo}</span>{aberto ? <ChevronDown size={15}/> : <ChevronRight size={15}/>}
                </button>
                {aberto && (
                  <div className="mb-1 ml-3 space-y-0.5 border-l border-slate-200 pl-2">
                    {grupo.grupo === 'Comercial' && balcaoCombina && (
                      <Link href="/balcao" className={`flex items-center gap-2 rounded-lg px-2.5 py-2 text-[13px] transition ${ativo('/balcao') ? 'bg-brand-navy font-semibold text-white' : 'text-slate-600 hover:bg-slate-100'}`}>
                        <Store size={16}/> Venda Balcão
                      </Link>
                    )}
                    {grupo.itens.map(guia => {
                      const Icon = guia.icon
                      const selecionado = ativo(guia.href)
                      return (
                        <Link key={guia.href} href={guia.href} className={`flex items-center gap-2 rounded-lg px-2.5 py-2 text-[13px] transition ${selecionado ? 'bg-brand-navy font-semibold text-white' : 'text-slate-600 hover:bg-slate-100'}`}>
                          <Icon size={16} className="shrink-0" /><span>{guia.label}</span>
                        </Link>
                      )
                    })}
                    {grupo.grupo === 'Compras' && entradaNfCombina && !grupo.itens.some(item => item.href === '/compras/entrada') && (
                      <Link href="/compras/entrada" className={`flex items-center gap-2 rounded-lg px-2.5 py-2 text-[13px] ${ativo('/compras/entrada')?'bg-brand-navy font-semibold text-white':'text-slate-600 hover:bg-slate-100'}`}><ReceiptText size={16}/> Entrada de NF</Link>
                    )}
                  </div>
                )}
              </section>
            )
          })}

          {(relatoriosCombina || consultoriaCombina) && (
            <section>
              <button type="button" aria-expanded={!!termo || !!gruposAbertos['Relatórios']} onClick={() => setGruposAbertos(prev => ({...prev,'Relatórios':!prev['Relatórios']}))}
                className="flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-[13px] font-semibold text-slate-600 hover:bg-slate-50 hover:text-slate-800">
                <span className="flex items-center gap-2"><BarChart3 size={16}/> Relatórios</span>
                {(!!termo || !!gruposAbertos['Relatórios'])?<ChevronDown size={15}/>:<ChevronRight size={15}/>}
              </button>
              {(!!termo || !!gruposAbertos['Relatórios']) && <div className="ml-3 space-y-0.5 border-l border-slate-200 pl-2">
                {relatoriosCombina && <Link href="/relatorios" className={`flex items-center gap-2 rounded-lg px-2.5 py-2 text-[13px] ${ativo('/relatorios')?'bg-brand-navy font-semibold text-white':'text-slate-600 hover:bg-slate-100'}`}><BarChart3 size={16}/> Relatórios</Link>}
                {consultoriaCombina && <Link href="/relatorios/esquadrifacio" className={`flex items-center gap-2 rounded-lg px-2.5 py-2 text-[13px] ${ativo('/relatorios/esquadrifacio')?'bg-brand-navy font-semibold text-white':'text-slate-600 hover:bg-slate-100'}`}><BookOpen size={16}/> Esquadrifácio</Link>}
              </div>}
            </section>
          )}

          {(iaCombina || supervisaoIaCombina) && (
            <section>
              <button type="button" aria-expanded={!!termo || !!gruposAbertos['IA Atlas']} onClick={() => setGruposAbertos(prev => ({...prev,'IA Atlas':!prev['IA Atlas']}))}
                className="flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-[13px] font-semibold text-slate-600 hover:bg-slate-50 hover:text-slate-800">
                <span className="flex items-center gap-2"><Bot size={16}/> IA Atlas</span>
                {(!!termo || !!gruposAbertos['IA Atlas'])?<ChevronDown size={15}/>:<ChevronRight size={15}/>}
              </button>
              {(!!termo || !!gruposAbertos['IA Atlas']) && <div className="ml-3 space-y-0.5 border-l border-slate-200 pl-2">
                {iaCombina && <Link href="/atlas-ia" className={`flex items-center gap-2 rounded-lg px-2.5 py-2 text-[13px] ${ativo('/atlas-ia')?'bg-brand-navy font-semibold text-white':'text-slate-600 hover:bg-slate-100'}`}><Bot size={16}/> IA Atlas</Link>}
                {supervisaoIaCombina && <Link href="/atlas-ia/supervisao" className={`flex items-center gap-2 rounded-lg px-2.5 py-2 text-[13px] ${ativo('/atlas-ia/supervisao')?'bg-brand-navy font-semibold text-white':'text-slate-600 hover:bg-slate-100'}`}><Eye size={16}/> Supervisão da IA</Link>}
              </div>}
            </section>
          )}

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