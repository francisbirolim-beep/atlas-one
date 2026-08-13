'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Bell, ChevronDown, Command, FileText, MapPin, Plus, Search, Sparkles, UserRound, X } from 'lucide-react'
import { usuarioAtual } from '@/lib/auth'
import { supabase } from '@/lib/supabase'
import { bateBusca } from '@/lib/texto'
import type { Usuario } from '@/lib/tipos'

const TITULOS: { prefixo: string; titulo: string; grupo: string }[] = [
  { prefixo: '/kanban', titulo: 'Kanban Comercial', grupo: 'Comercial' },
  { prefixo: '/vendas/confirmar', titulo: 'Confirmar Venda', grupo: 'Comercial' },
  { prefixo: '/orcamento', titulo: 'Orçamentos', grupo: 'Comercial' },
  { prefixo: '/clientes', titulo: 'Clientes', grupo: 'Comercial' },
  { prefixo: '/crm', titulo: 'CRM', grupo: 'Comercial' },
  { prefixo: '/producao/medicao-final', titulo: 'Medição Final', grupo: 'Operações' },
  { prefixo: '/producao', titulo: 'Produção', grupo: 'Operações' },
  { prefixo: '/setores', titulo: 'Setores', grupo: 'Operações' },
  { prefixo: '/financeiro', titulo: 'Financeiro', grupo: 'Financeiro' },
  { prefixo: '/configuracoes', titulo: 'Configurações', grupo: 'Administração' },
  { prefixo: '/historico', titulo: 'Histórico', grupo: 'Administração' },
]

type ResultadoBusca = {
  id: string
  tipo: 'cliente' | 'orcamento' | 'medicao'
  titulo: string
  subtitulo: string
  href: string
}

function iniciais(nome?: string | null) {
  const partes = (nome || 'Usuário').trim().split(/\s+/).filter(Boolean)
  return partes.slice(0, 2).map(p => p[0]?.toUpperCase()).join('') || 'U'
}

function IconeResultado({ tipo }: { tipo: ResultadoBusca['tipo'] }) {
  if (tipo === 'cliente') return <UserRound size={16} />
  if (tipo === 'medicao') return <MapPin size={16} />
  return <FileText size={16} />
}

export default function AppTopbar() {
  const pathname = usePathname()
  const [usuario, setUsuario] = useState<Usuario | null>(null)
  const [buscaAberta, setBuscaAberta] = useState(false)
  const [termo, setTermo] = useState('')
  const [resultados, setResultados] = useState<ResultadoBusca[]>([])
  const [buscando, setBuscando] = useState(false)
  const [erroBusca, setErroBusca] = useState('')

  useEffect(() => {
    usuarioAtual().then(setUsuario)
  }, [])

  useEffect(() => {
    function atalho(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setBuscaAberta(true)
      }
      if (e.key === 'Escape') setBuscaAberta(false)
    }
    window.addEventListener('keydown', atalho)
    return () => window.removeEventListener('keydown', atalho)
  }, [])

  useEffect(() => {
    const q = termo.trim()
    if (q.length < 2) {
      setResultados([])
      setBuscando(false)
      setErroBusca('')
      return
    }

    let cancelado = false
    const timer = window.setTimeout(async () => {
      setBuscando(true)
      setErroBusca('')

      try {
        const [clientesResp, orcamentosResp, medicoesResp] = await Promise.all([
          supabase.from('clientes').select('*').order('created_at', { ascending: false }).limit(300),
          supabase.from('orcamentos').select('*').order('created_at', { ascending: false }).limit(300),
          supabase.from('medicoes_finais').select('*').order('created_at', { ascending: false }).limit(200),
        ])

        if (cancelado) return

        const erros = [clientesResp.error, orcamentosResp.error, medicoesResp.error].filter(Boolean)
        if (erros.length === 3) {
          setErroBusca('Não foi possível consultar os dados agora. Tente novamente em instantes.')
          setResultados([])
          return
        }

        const encontrados: ResultadoBusca[] = []

        for (const c of (clientesResp.data || []) as any[]) {
          if (bateBusca(q, c.nome, c.apelido, c.cidade, c.bairro, c.cep, c.endereco, c.cpf_cnpj, c.whatsapp, c.telefone, c.email)) {
            encontrados.push({
              id: `cliente-${c.id}`,
              tipo: 'cliente',
              titulo: c.apelido ? `${c.nome || 'CLIENTE'} (${c.apelido})` : (c.nome || 'CLIENTE'),
              subtitulo: [c.cidade, c.whatsapp || c.telefone].filter(Boolean).join(' · ') || 'Cliente',
              href: `/clientes/${c.id}`,
            })
          }
        }

        for (const o of (orcamentosResp.data || []) as any[]) {
          if (bateBusca(q, o.numero, o.cliente_nome, o.cidade, o.cliente_whatsapp, o.criado_por_nome)) {
            encontrados.push({
              id: `orcamento-${o.id}`,
              tipo: 'orcamento',
              titulo: `ORÇAMENTO ${o.numero ? `#${o.numero}` : ''} — ${o.cliente_nome || 'SEM CLIENTE'}`.trim(),
              subtitulo: [o.cidade, o.valor_estimado != null ? `R$ ${Number(o.valor_estimado).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}` : null].filter(Boolean).join(' · '),
              href: `/kanban?orcamento=${o.id}`,
            })
          }
        }

        for (const m of (medicoesResp.data || []) as any[]) {
          if (bateBusca(q, m.cliente_nome, m.cidade, m.bairro, m.endereco, m.cep)) {
            encontrados.push({
              id: `medicao-${m.id}`,
              tipo: 'medicao',
              titulo: `MEDIÇÃO — ${m.cliente_nome || 'SEM CLIENTE'}`,
              subtitulo: [m.endereco, m.cidade].filter(Boolean).join(' · '),
              href: `/producao/medicao-final/${m.id}`,
            })
          }
        }

        setResultados(encontrados.slice(0, 20))
      } catch (error) {
        console.error('Erro na busca global:', error)
        if (!cancelado) {
          setErroBusca('A busca encontrou um erro ao consultar os dados.')
          setResultados([])
        }
      } finally {
        if (!cancelado) setBuscando(false)
      }
    }, 180)

    return () => {
      cancelado = true
      window.clearTimeout(timer)
    }
  }, [termo])

  const contexto = useMemo(() => {
    if (pathname === '/') return { titulo: 'Painel de Gestão', grupo: 'Visão geral' }
    return TITULOS.find(item => pathname.startsWith(item.prefixo)) || { titulo: 'Atlas One', grupo: 'Sistema' }
  }, [pathname])

  function abrirBusca() {
    setBuscaAberta(true)
    window.setTimeout(() => document.getElementById('atlas-global-search')?.focus(), 0)
  }

  function fecharBusca() {
    setBuscaAberta(false)
    setTermo('')
    setResultados([])
    setErroBusca('')
  }

  return (
    <>
      <header className="sticky top-0 z-30 border-b border-slate-200/70 bg-white/90 backdrop-blur-xl">
        <div className="flex h-[68px] items-center gap-3 px-3 sm:px-4 md:px-6 lg:px-7">
          <div className="flex min-w-0 flex-1 items-center gap-3 xl:max-w-[340px]">
            <Link href="/ia/comercial" className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl bg-slate-950 text-white shadow-sm transition hover:bg-slate-800 md:hidden" title="Abrir IA Atlas">
              <Sparkles size={17} />
            </Link>
            <div className="min-w-0">
              <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-400 sm:text-[11px]">
                <span>{contexto.grupo}</span>
                <span className="h-1 w-1 rounded-full bg-emerald-500" />
                <span className="normal-case tracking-normal text-slate-400">Atlas One</span>
              </div>
              <div className="mt-0.5 truncate text-[15px] font-semibold tracking-tight text-slate-950 sm:text-base">{contexto.titulo}</div>
            </div>
          </div>

          <div className="hidden min-w-0 flex-1 justify-center xl:flex">
            <button type="button" onClick={abrirBusca} className="group flex h-10 w-full max-w-2xl items-center gap-2.5 rounded-xl border border-slate-200 bg-slate-50/80 px-3.5 text-left text-sm text-slate-400 shadow-inner transition hover:border-slate-300 hover:bg-white" title="Busca global">
              <Search size={16} className="text-slate-400 group-hover:text-slate-600" />
              <span className="flex-1 truncate">Buscar cliente, obra, orçamento, medição...</span>
              <span className="flex items-center gap-1 rounded-md border border-slate-200 bg-white px-1.5 py-1 text-[10px] font-semibold text-slate-400 shadow-sm"><Command size={10} /> K</span>
            </button>
          </div>

          <div className="flex flex-1 items-center justify-end gap-2 xl:max-w-[430px]">
            <Link href="/orcamento-rapido" className="hidden h-10 items-center gap-2 rounded-xl bg-emerald-600 px-3.5 text-sm font-semibold text-white shadow-sm shadow-emerald-600/15 transition hover:bg-emerald-700 sm:inline-flex" title="Criar novo orçamento rápido">
              <Plus size={16} /> Novo
            </Link>

            <Link href="/ia/comercial" className="hidden h-10 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3.5 text-sm font-semibold text-slate-700 shadow-sm transition hover:border-slate-300 hover:bg-slate-50 lg:inline-flex" title="Abrir IA Atlas">
              <Sparkles size={15} className="text-emerald-600" /> IA Atlas
            </Link>

            <button type="button" onClick={abrirBusca} className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-500 shadow-sm transition hover:bg-slate-50 xl:hidden" title="Busca global">
              <Search size={16} />
            </button>

            <button type="button" className="relative flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-500 shadow-sm transition hover:bg-slate-50" title="Notificações — em breve">
              <Bell size={16} />
              <span className="absolute right-2 top-2 h-2 w-2 rounded-full border-2 border-white bg-emerald-500" />
            </button>

            <button type="button" className="ml-1 flex h-11 items-center gap-2.5 rounded-xl border border-transparent px-1.5 transition hover:border-slate-200 hover:bg-slate-50">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-950 text-xs font-bold text-white shadow-sm">{iniciais(usuario?.nome)}</div>
              <div className="hidden min-w-0 text-left sm:block">
                <div className="max-w-32 truncate text-sm font-semibold text-slate-800">{usuario?.nome || 'Usuário'}</div>
                <div className="text-[10px] font-medium uppercase tracking-wide text-slate-400">{usuario?.role || 'usuário'}</div>
              </div>
              <ChevronDown size={14} className="hidden text-slate-400 sm:block" />
            </button>
          </div>
        </div>
      </header>

      {buscaAberta && (
        <div className="fixed inset-0 z-[100] bg-slate-950/35 px-3 pt-[12vh] backdrop-blur-sm" onMouseDown={e => { if (e.currentTarget === e.target) fecharBusca() }}>
          <div className="mx-auto w-full max-w-2xl overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
            <div className="flex items-center gap-3 border-b border-slate-100 px-4 py-3">
              <Search size={18} className="text-slate-400" />
              <input id="atlas-global-search" value={termo} onChange={e => setTermo(e.target.value)} autoFocus className="min-w-0 flex-1 bg-transparent text-base text-slate-900 outline-none placeholder:text-slate-400" placeholder="Digite nome, apelido, cidade, CEP, orçamento..." />
              <button onClick={fecharBusca} className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700" title="Fechar"><X size={17} /></button>
            </div>

            <div className="max-h-[58vh] overflow-y-auto p-2">
              {termo.trim().length < 2 ? (
                <div className="px-4 py-10 text-center text-sm text-slate-400">Digite pelo menos 2 caracteres. A busca ignora acentos e maiúsculas/minúsculas.</div>
              ) : buscando ? (
                <div className="px-4 py-10 text-center text-sm text-slate-400">Pesquisando...</div>
              ) : erroBusca ? (
                <div className="px-4 py-10 text-center text-sm text-red-500">{erroBusca}</div>
              ) : resultados.length === 0 ? (
                <div className="px-4 py-10 text-center text-sm text-slate-400">Nenhum resultado encontrado.</div>
              ) : (
                <div className="space-y-1">
                  {resultados.map(resultado => (
                    <Link key={resultado.id} href={resultado.href} onClick={fecharBusca} className="flex items-start gap-3 rounded-xl px-3 py-3 transition hover:bg-slate-50">
                      <div className="mt-0.5 flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-600"><IconeResultado tipo={resultado.tipo} /></div>
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm font-semibold text-slate-800">{resultado.titulo}</div>
                        <div className="mt-0.5 truncate text-xs text-slate-500">{resultado.subtitulo}</div>
                      </div>
                      <span className="mt-1 rounded-full bg-slate-100 px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-slate-500">{resultado.tipo}</span>
                    </Link>
                  ))}
                </div>
              )}
            </div>

            <div className="border-t border-slate-100 bg-slate-50 px-4 py-2.5 text-[11px] text-slate-400">Ex.: “joao” encontra “JOÃO”; “sao jose” encontra “SÃO JOSÉ”.</div>
          </div>
        </div>
      )}
    </>
  )
}
