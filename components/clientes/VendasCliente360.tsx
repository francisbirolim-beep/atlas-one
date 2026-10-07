'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { Building2, ChevronRight, CircleDollarSign, FileText, Loader2 } from 'lucide-react'
import { supabase } from '@/lib/supabase'

type VendaObra = {
  id: string
  numero?: number | null
  orcamento_id: string
  cliente_id: string
  obra_id?: string | null
  valor_venda?: number | null
  custo_previsto?: number | null
  status?: string | null
  confirmado_em?: string | null
  created_at?: string | null
}

type OrcamentoVenda = {
  id: string
  numero?: number | null
  status?: string | null
  valor_estimado?: number | null
  wvetro_fluxo?: { numero?: string | null; origem?: string | null } | null
}

type ObraVenda = {
  id: string
  numero?: number | null
  nome: string
  status?: string | null
}

type ContaVenda = {
  id: string
  venda_obra_id?: string | null
  valor?: number | null
  valor_pago?: number | null
  valor_desconto?: number | null
  status?: string | null
}

interface Props { clienteId: string }

function moeda(v?: number | null){
  return Number(v || 0).toLocaleString('pt-BR',{style:'currency',currency:'BRL'})
}
function dataBR(v?: string | null){
  if(!v) return '—'
  const d = new Date(v)
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleDateString('pt-BR')
}
function status(v?: string | null){
  return v ? v.replace(/_/g,' ').replace(/^./,s=>s.toUpperCase()) : 'Em andamento'
}
function numeroOrcamento(o?: OrcamentoVenda){
  return o?.wvetro_fluxo?.numero || o?.numero || '—'
}

export default function VendasCliente360({clienteId}:Props){
  const [vendas,setVendas]=useState<VendaObra[]>([])
  const [orcamentos,setOrcamentos]=useState<Record<string,OrcamentoVenda>>({})
  const [obras,setObras]=useState<Record<string,ObraVenda>>({})
  const [contas,setContas]=useState<ContaVenda[]>([])
  const [carregando,setCarregando]=useState(true)
  const [erro,setErro]=useState('')

  useEffect(()=>{ void carregar() },[clienteId])

  async function carregar(){
    setCarregando(true); setErro('')
    const vendasResp = await supabase
      .from('vendas_obras')
      .select('id,numero,orcamento_id,cliente_id,obra_id,valor_venda,custo_previsto,status,confirmado_em,created_at')
      .eq('cliente_id',clienteId)
      .order('confirmado_em',{ascending:false})

    if(vendasResp.error){ setErro(vendasResp.error.message); setCarregando(false); return }
    const lista=(vendasResp.data||[]) as VendaObra[]
    setVendas(lista)

    const orcIds=[...new Set(lista.map(v=>v.orcamento_id).filter(Boolean))]
    const obraIds=[...new Set(lista.map(v=>v.obra_id).filter(Boolean))] as string[]
    const vendaIds=lista.map(v=>v.id)

    const [orcResp,obraResp,contasResp]=await Promise.all([
      orcIds.length
        ? supabase.from('orcamentos').select('id,numero,status,valor_estimado,wvetro_fluxo').in('id',orcIds)
        : Promise.resolve({data:[],error:null} as any),
      obraIds.length
        ? supabase.from('obras').select('id,numero,nome,status').in('id',obraIds)
        : Promise.resolve({data:[],error:null} as any),
      vendaIds.length
        ? supabase.from('financeiro_contas_receber').select('id,venda_obra_id,valor,valor_pago,valor_desconto,status').in('venda_obra_id',vendaIds)
        : Promise.resolve({data:[],error:null} as any),
    ])

    if(orcResp.error||obraResp.error||contasResp.error){
      setErro(orcResp.error?.message||obraResp.error?.message||contasResp.error?.message||'Não foi possível carregar todos os dados da venda.')
    }
    setOrcamentos(Object.fromEntries(((orcResp.data||[]) as OrcamentoVenda[]).map(o=>[o.id,o])))
    setObras(Object.fromEntries(((obraResp.data||[]) as ObraVenda[]).map(o=>[o.id,o])))
    setContas((contasResp.data||[]) as ContaVenda[])
    setCarregando(false)
  }

  const totalVendido=useMemo(()=>vendas.reduce((s,v)=>s+Number(v.valor_venda||orcamentos[v.orcamento_id]?.valor_estimado||0),0),[vendas,orcamentos])
  const totalRecebido=useMemo(()=>contas.filter(c=>c.status!=='cancelado').reduce((s,c)=>s+Number(c.valor_pago||0),0),[contas])
  const totalAberto=useMemo(()=>contas.filter(c=>c.status!=='cancelado').reduce((s,c)=>s+Math.max(0,Number(c.valor||0)-Number(c.valor_pago||0)-Number(c.valor_desconto||0)),0),[contas])

  if(carregando) return <div className="rounded-2xl border bg-white p-8 text-center text-sm text-slate-500"><Loader2 size={16} className="mx-auto mb-2 animate-spin"/>Carregando vendas...</div>

  return <div className="space-y-5">
    {erro&&<div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{erro}</div>}

    <div className="grid gap-3 sm:grid-cols-3">
      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <p className="text-[11px] font-bold uppercase tracking-wide text-slate-400">Vendas</p>
        <p className="mt-1 text-2xl font-bold text-slate-900">{vendas.length}</p>
      </div>
      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <p className="text-[11px] font-bold uppercase tracking-wide text-slate-400">Total vendido</p>
        <p className="mt-1 text-xl font-bold text-slate-900">{moeda(totalVendido)}</p>
      </div>
      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <p className="text-[11px] font-bold uppercase tracking-wide text-slate-400">Saldo a receber</p>
        <p className="mt-1 text-xl font-bold text-brand-teal">{moeda(totalAberto)}</p>
      </div>
    </div>

    <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-100 px-5 py-4">
        <h2 className="font-bold text-slate-800">Vendas / Obras</h2>
        <p className="mt-1 text-xs text-slate-500">Cada venda fica separada por orçamento e obra. Tudo que for lançado depois usa este vínculo.</p>
      </div>

      <div className="divide-y divide-slate-100">
        {vendas.map(v=>{
          const o=orcamentos[v.orcamento_id]
          const obra=v.obra_id?obras[v.obra_id]:undefined
          const valor=Number(v.valor_venda||o?.valor_estimado||0)
          const contasVenda=contas.filter(c=>c.venda_obra_id===v.id&&c.status!=='cancelado')
          const recebido=contasVenda.reduce((s,c)=>s+Number(c.valor_pago||0),0)
          const saldo=contasVenda.reduce((s,c)=>s+Math.max(0,Number(c.valor||0)-Number(c.valor_pago||0)-Number(c.valor_desconto||0)),0)
          return <Link key={v.id} href={`/clientes/${clienteId}/vendas/${v.id}`} className="flex flex-col gap-3 px-5 py-4 transition hover:bg-slate-50 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center gap-1.5 font-bold text-slate-900"><Building2 size={15} className="text-brand-navy"/>{obra?.nome||`Venda #${v.numero||'—'}`}</span>
                <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-700">{status(v.status||obra?.status||'ativa')}</span>
              </div>
              <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500">
                <span className="inline-flex items-center gap-1"><FileText size={12}/> Orçamento #{numeroOrcamento(o)}</span>
                {obra?.numero&&<span>Obra #{obra.numero}</span>}
                <span>Venda em {dataBR(v.confirmado_em||v.created_at)}</span>
              </p>
            </div>
            <div className="flex items-center justify-between gap-5 sm:justify-end">
              <div className="text-right">
                <p className="font-bold text-slate-900">{moeda(valor)}</p>
                <p className="text-xs text-slate-500">{moeda(recebido)} recebido · {moeda(saldo)} saldo</p>
              </div>
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-100 text-slate-500"><ChevronRight size={18}/></span>
            </div>
          </Link>
        })}
        {!vendas.length&&<div className="px-5 py-10 text-center">
          <CircleDollarSign size={28} className="mx-auto text-slate-300"/>
          <p className="mt-2 text-sm font-semibold text-slate-600">Nenhuma venda confirmada ainda.</p>
          <p className="mt-1 text-xs text-slate-400">Ao confirmar um orçamento em Vendido no Kanban, a venda passa a aparecer aqui automaticamente.</p>
        </div>}
      </div>
    </section>
  </div>
}
