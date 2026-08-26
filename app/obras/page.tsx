'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { Building2, Filter, MapPin, Search, UserRound } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { correspondeBuscaAtlas } from '@/lib/buscaAtlas'

type ObraLista = {
  id: string
  numero: number
  cliente_id: string
  nome: string
  status: string
  bairro?: string | null
  cidade?: string | null
  previsao_entrega?: string | null
  updated_at: string
  clientes?: { id: string; nome: string; cidade?: string | null; whatsapp?: string | null; telefone?: string | null } | null
}

type ContaObra = { obra_id?: string | null; valor: number; valor_pago?: number | null; status: string }

const STATUS: Record<string, { label: string; cls: string }> = {
  planejamento: { label: 'Planejamento', cls: 'bg-slate-100 text-slate-600' },
  orcamento: { label: 'Orçamento', cls: 'bg-blue-50 text-blue-700' },
  medicao: { label: 'Medição', cls: 'bg-cyan-50 text-cyan-700' },
  engenharia: { label: 'Engenharia', cls: 'bg-purple-50 text-purple-700' },
  compras: { label: 'Compras', cls: 'bg-amber-50 text-amber-700' },
  producao: { label: 'Produção', cls: 'bg-orange-50 text-orange-700' },
  instalacao: { label: 'Instalação', cls: 'bg-indigo-50 text-indigo-700' },
  concluida: { label: 'Concluída', cls: 'bg-emerald-50 text-emerald-700' },
  pausada: { label: 'Pausada', cls: 'bg-red-50 text-red-700' },
}

function moeda(v: number) { return Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) }
function dataBR(v?: string | null) { if (!v) return '—'; const d = new Date(`${v.slice(0,10)}T12:00:00`); return Number.isNaN(d.getTime()) ? '—' : d.toLocaleDateString('pt-BR') }

export default function ObrasPage() {
  const [obras, setObras] = useState<ObraLista[]>([])
  const [contas, setContas] = useState<ContaObra[]>([])
  const [busca, setBusca] = useState('')
  const [status, setStatus] = useState('')
  const [carregando, setCarregando] = useState(true)

  useEffect(() => { void carregar() }, [])

  async function carregar() {
    setCarregando(true)
    const [obrasResp, contasResp] = await Promise.all([
      supabase.from('obras').select('*,clientes(id,nome,cidade,whatsapp,telefone)').order('updated_at', { ascending: false }),
      supabase.from('financeiro_contas_receber').select('obra_id,valor,valor_pago,status').not('obra_id', 'is', null),
    ])
    setObras((obrasResp.data || []) as ObraLista[])
    setContas((contasResp.data || []) as ContaObra[])
    setCarregando(false)
  }

  const saldoPorObra = useMemo(() => {
    const mapa: Record<string, number> = {}
    for (const c of contas) {
      if (!c.obra_id || c.status === 'cancelado') continue
      mapa[c.obra_id] = (mapa[c.obra_id] || 0) + Math.max(0, Number(c.valor || 0) - Number(c.valor_pago || 0))
    }
    return mapa
  }, [contas])

  const filtradas = useMemo(() => obras.filter(o => {
    if (status && o.status !== status) return false
    if (!busca.trim()) return true
    return correspondeBuscaAtlas(busca, o.nome, o.numero, o.status, o.bairro, o.cidade, o.clientes?.nome, o.clientes?.cidade, o.clientes?.whatsapp, o.clientes?.telefone)
  }), [obras, busca, status])

  return <div className="min-h-screen bg-slate-50">
    <header className="border-b border-slate-200 bg-white">
      <div className="mx-auto max-w-7xl px-4 py-5">
        <div className="flex items-center gap-3"><div className="rounded-xl bg-brand-navyLight p-2 text-brand-navy"><Building2 size={22}/></div><div><h1 className="text-xl font-bold text-slate-900">Obras</h1><p className="text-sm text-slate-500">Visão geral das obras de todos os clientes.</p></div></div>
      </div>
    </header>

    <main className="mx-auto max-w-7xl px-4 py-5">
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-2xl border bg-white p-4"><p className="text-xs uppercase text-slate-400">Total de obras</p><p className="mt-1 text-2xl font-bold">{obras.length}</p></div>
        <div className="rounded-2xl border bg-white p-4"><p className="text-xs uppercase text-slate-400">Em andamento</p><p className="mt-1 text-2xl font-bold">{obras.filter(o => !['concluida','pausada'].includes(o.status)).length}</p></div>
        <div className="rounded-2xl border bg-white p-4"><p className="text-xs uppercase text-slate-400">A receber nas obras</p><p className="mt-1 text-2xl font-bold text-brand-teal">{moeda(Object.values(saldoPorObra).reduce((s,v)=>s+v,0))}</p></div>
      </div>

      <div className="mt-5 flex flex-col gap-2 rounded-2xl border bg-white p-3 sm:flex-row">
        <div className="relative flex-1"><Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"/><input value={busca} onChange={e=>setBusca(e.target.value)} placeholder="Buscar obra, cliente, cidade, bairro..." className="w-full rounded-xl border border-slate-200 py-2.5 pl-9 pr-3 text-sm"/></div>
        <div className="relative sm:w-56"><Filter size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"/><select value={status} onChange={e=>setStatus(e.target.value)} className="w-full rounded-xl border border-slate-200 py-2.5 pl-9 pr-3 text-sm"><option value="">Todos os status</option>{Object.entries(STATUS).map(([k,v])=><option key={k} value={k}>{v.label}</option>)}</select></div>
      </div>

      <p className="mt-4 text-xs text-slate-500">{filtradas.length} obra(s)</p>
      {carregando ? <div className="py-16 text-center text-slate-400">Carregando obras...</div> : filtradas.length === 0 ? <div className="mt-4 rounded-2xl border border-dashed bg-white py-14 text-center text-slate-400">Nenhuma obra encontrada.</div> : <div className="mt-3 grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
        {filtradas.map(o => <Link key={o.id} href={`/obras/${o.id}`} className="group rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition hover:border-brand-navy/40 hover:shadow-md">
          <div className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="truncate text-base font-bold text-slate-800 group-hover:text-brand-navy">{o.nome}</p><p className="mt-1 text-xs text-slate-400">Obra #{o.numero}</p></div><span className={`rounded-full px-2 py-1 text-[11px] font-semibold ${STATUS[o.status]?.cls || 'bg-slate-100 text-slate-600'}`}>{STATUS[o.status]?.label || o.status}</span></div>
          <div className="mt-4 space-y-2 text-sm text-slate-500"><p className="flex items-center gap-2"><UserRound size={14}/><span className="truncate">{o.clientes?.nome || 'Cliente não identificado'}</span></p>{(o.bairro || o.cidade) && <p className="flex items-center gap-2"><MapPin size={14}/><span className="truncate">{[o.bairro,o.cidade].filter(Boolean).join(' · ')}</span></p>}</div>
          <div className="mt-4 grid grid-cols-2 gap-2 border-t pt-3"><div><p className="text-[10px] uppercase text-slate-400">A receber</p><p className="text-sm font-bold text-brand-teal">{moeda(saldoPorObra[o.id] || 0)}</p></div><div className="text-right"><p className="text-[10px] uppercase text-slate-400">Previsão</p><p className="text-sm font-semibold text-slate-700">{dataBR(o.previsao_entrega)}</p></div></div>
        </Link>)}
      </div>}
    </main>
  </div>
}
