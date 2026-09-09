'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import {
  ArrowLeft, ChevronRight, ClipboardList, Headphones, LayoutDashboard, Loader2,
  PackagePlus, Pencil, Search, ShoppingCart, UserCheck, UserPlus,
} from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { correspondeBuscaAtlas } from '@/lib/buscaAtlas'
import { obterOuCriarCliente } from '@/lib/clientes'
import type { Cliente } from '@/lib/tipos'

type ClienteBusca = Pick<Cliente, 'id' | 'nome' | 'whatsapp' | 'telefone' | 'cidade' | 'bairro' | 'cpf_cnpj'> & { apelido?: string | null }

function temNomeCompleto(nome: string) {
  return nome.trim().split(/\s+/).filter(Boolean).length >= 2
}

function iniciais(nome: string) {
  return nome.trim().split(/\s+/).slice(0, 2).map((parte) => parte[0]?.toUpperCase()).join('') || 'CL'
}

export default function IdentificarCliente() {
  const [busca, setBusca] = useState('')
  const [clientes, setClientes] = useState<ClienteBusca[]>([])
  const [carregando, setCarregando] = useState(true)
  const [erroBusca, setErroBusca] = useState('')
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState('')
  const [clienteSelecionado, setClienteSelecionado] = useState<ClienteBusca | null>(null)

  useEffect(() => {
    supabase.from('clientes').select('*').order('nome').limit(1000).then(({ data, error }) => {
      if (error) {
        setErroBusca('Não foi possível consultar os clientes agora. Atualize a página e tente novamente.')
        setClientes([])
      } else {
        setErroBusca('')
        setClientes((data || []) as ClienteBusca[])
      }
      setCarregando(false)
    })
  }, [])

  const encontrados = useMemo(() => {
    if (busca.trim().length < 2) return []
    return clientes.filter((cliente) => correspondeBuscaAtlas(
      busca, cliente.nome, cliente.apelido, cliente.whatsapp, cliente.telefone,
      cliente.cidade, cliente.bairro, cliente.cpf_cnpj,
    )).slice(0, 8)
  }, [busca, clientes])

  async function cadastrarEAbrir() {
    setErro('')
    if (!temNomeCompleto(busca)) {
      setErro('Informe nome e sobrenome para criar o cliente.')
      return
    }
    setSalvando(true)
    const id = await obterOuCriarCliente({ nome: busca.trim() })
    setSalvando(false)
    if (!id) {
      setErro('Não foi possível criar o Cliente 360. Tente novamente.')
      return
    }
    setClienteSelecionado({ id, nome: busca.trim() })
  }

  const acoes = clienteSelecionado ? [
    { titulo: 'Pedido de orçamento', subtitulo: 'Registrar visita e enviar ao Kanban', icone: ClipboardList, href: `/orcamento-rapido?cliente=${encodeURIComponent(clienteSelecionado.id)}`, cor: 'bg-blue-50 text-blue-600' },
    { titulo: 'Orçamento sob medida', subtitulo: 'Montar com tipologia e variáveis', icone: Pencil, href: `/orcamento-rapido?cliente=${encodeURIComponent(clienteSelecionado.id)}`, cor: 'bg-emerald-50 text-emerald-600' },
    { titulo: 'Balcão', subtitulo: 'Venda de produtos', icone: ShoppingCart, href: `/orcamento/balcao/novo?cliente=${encodeURIComponent(clienteSelecionado.id)}`, cor: 'bg-amber-50 text-amber-700' },
    { titulo: 'Assistência', subtitulo: 'Pós-venda e manutenção', icone: Headphones, href: `/assistencia?cliente=${encodeURIComponent(clienteSelecionado.id)}`, cor: 'bg-violet-50 text-violet-700' },
    { titulo: 'Pedido de compra', subtitulo: 'Enviar necessidade direto ao comprador', icone: PackagePlus, href: `/compras?cliente=${encodeURIComponent(clienteSelecionado.id)}&clienteNome=${encodeURIComponent(clienteSelecionado.nome)}`, cor: 'bg-red-50 text-red-700' },
    { titulo: 'Abrir cliente', subtitulo: 'Ver histórico, orçamentos, pedidos e finanças', icone: LayoutDashboard, href: `/clientes/${clienteSelecionado.id}`, cor: 'bg-slate-100 text-brand-navy' },
  ] : []

  if (clienteSelecionado) {
    return (
      <div className="min-h-[100dvh] bg-slate-50 pb-[calc(5.5rem+env(safe-area-inset-bottom))] sm:bg-gradient-to-br sm:from-slate-50 sm:to-brand-navyLight sm:p-6">
        <header className="sticky top-0 z-20 bg-brand-navy px-5 pb-4 pt-[calc(1rem+env(safe-area-inset-top))] text-white sm:mx-auto sm:max-w-lg sm:rounded-t-2xl sm:pt-4">
          <div className="relative flex min-h-14 items-center justify-center">
            <button type="button" onClick={() => setClienteSelecionado(null)} className="absolute left-0 inline-flex items-center gap-1 rounded-lg py-2 pr-2 text-sm font-semibold"><ArrowLeft size={22} /> Voltar</button>
            <div className="text-center">
              <h1 className="text-xl font-bold">Cliente 360</h1>
              <p className="mt-0.5 text-sm text-white/75">Escolha a ação</p>
            </div>
          </div>
        </header>

        <main className="mx-auto max-w-lg space-y-3.5 px-4 py-4 sm:bg-white sm:pb-6 sm:shadow-xl">
          <Link href={`/clientes/${clienteSelecionado.id}`} className="flex items-center gap-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-indigo-50 text-lg font-bold text-brand-navy">{iniciais(clienteSelecionado.nome)}</span>
            <span className="min-w-0 flex-1">
              <strong className="block truncate text-lg text-slate-900">{clienteSelecionado.nome}</strong>
              <span className="mt-0.5 block text-sm text-slate-500">Cliente</span>
              {clienteSelecionado.cidade ? <span className="mt-0.5 block truncate text-sm text-slate-500">{clienteSelecionado.cidade}{clienteSelecionado.bairro ? ` • ${clienteSelecionado.bairro}` : ''}</span> : null}
            </span>
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 text-slate-500"><ChevronRight size={22} /></span>
          </Link>

          {acoes.map((acao) => {
            const Icone = acao.icone
            return (
              <Link key={acao.titulo} href={acao.href} className="flex min-h-[82px] items-center gap-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition active:scale-[0.99] sm:hover:border-brand-navy sm:hover:shadow-md">
                <span className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-xl ${acao.cor}`}><Icone size={27} strokeWidth={2} /></span>
                <span className="min-w-0 flex-1">
                  <strong className="block text-base font-bold text-slate-900">{acao.titulo}</strong>
                  <span className="mt-1 block text-sm leading-5 text-slate-500">{acao.subtitulo}</span>
                </span>
                <ChevronRight size={24} className="shrink-0 text-slate-500" />
              </Link>
            )
          })}
        </main>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-brand-navyLight">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-3xl items-center gap-4 px-4 py-4">
          <Link href="/" className="rounded-lg p-2 transition hover:bg-slate-100"><ArrowLeft size={20} /></Link>
          <img src="/icons/icon-mark.png" alt="" className="h-8 w-8" />
          <div><h1 className="text-lg font-bold text-slate-800">Identificar cliente</h1><p className="text-sm text-slate-500">Tudo começa pelo Cliente 360</p></div>
        </div>
      </header>
      <main className="mx-auto max-w-2xl px-4 py-8">
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-brand-navy">Cliente 360</p>
          <h2 className="mt-2 text-xl font-bold text-slate-900">Qual é o nome do cliente?</h2>
          <p className="mt-2 text-sm leading-6 text-slate-500">Comece a digitar o nome: os clientes já cadastrados aparecem abaixo. Clique em um deles para escolher o que fazer. Se o cliente ainda não existir, cadastre pelo menos nome e sobrenome.</p>
          <div className="relative mt-5"><Search size={18} className="absolute left-3 top-3.5 text-slate-400" /><input autoFocus value={busca} onChange={(e) => { setBusca(e.currentTarget.value); setErro('') }} placeholder="Digite nome e sobrenome..." className="w-full rounded-xl border border-slate-300 py-3 pl-10 pr-3 text-base outline-none transition focus:border-brand-navy focus:ring-2 focus:ring-brand-navy/10" /></div>
          {carregando ? <div className="mt-4 flex items-center gap-2 text-sm text-slate-500"><Loader2 size={16} className="animate-spin" /> Carregando clientes...</div> : null}
          {erroBusca ? <p className="mt-3 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{erroBusca}</p> : null}
          {encontrados.length > 0 ? <div className="mt-3 overflow-hidden rounded-xl border border-emerald-200 bg-white shadow-sm">{encontrados.map((cliente) => <button key={cliente.id} type="button" onClick={() => setClienteSelecionado(cliente)} className="flex w-full items-center gap-3 border-b border-slate-100 px-4 py-3 text-left last:border-b-0 hover:bg-slate-50"><span className="rounded-lg bg-emerald-50 p-2 text-emerald-700"><UserCheck size={16} /></span><span className="min-w-0 flex-1"><strong className="block text-sm text-slate-800">{cliente.nome}</strong><span className="block truncate text-xs text-slate-500">{[cliente.cidade, cliente.bairro, cliente.whatsapp || cliente.telefone].filter(Boolean).join(' • ') || 'Escolher ação'}</span></span><span className="text-xs font-semibold text-brand-navy">Abrir</span></button>)}</div> : null}
          {busca.trim().length >= 2 && encontrados.length === 0 && !carregando && !erroBusca ? <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-4"><p className="text-sm font-semibold text-amber-900">Nenhum cliente cadastrado com esse nome</p><button type="button" disabled={salvando} onClick={() => void cadastrarEAbrir()} className="mt-3 inline-flex items-center gap-2 rounded-xl bg-brand-navy px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60">{salvando ? <Loader2 size={16} className="animate-spin" /> : <UserPlus size={16} />} Cadastrar e abrir Cliente 360</button></div> : null}
          {erro ? <p className="mt-3 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{erro}</p> : null}
        </section>
      </main>
    </div>
  )
}
