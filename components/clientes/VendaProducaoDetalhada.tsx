'use client'

import { Factory, CheckCircle2, Clock3, AlertTriangle } from 'lucide-react'

type Ordem = {
  id:string
  numero?:number|null
  titulo?:string|null
  item_ref?:string|null
  quantidade?:number|null
  status?:string|null
  created_at:string
  tipo_producao?:string|null
  item_snapshot?:Record<string,any>|null
  largura_mm?:number|null
  altura_mm?:number|null
  bloqueada?:boolean|null
  bloqueio_motivo?:string|null
}

function statusLabel(v?:string|null){
  const s=String(v||'aguardando').toLowerCase()
  if(s==='concluida'||s==='concluido'||s==='produzido'||s==='pronto')return 'Produzido'
  if(s==='em_producao')return 'Em produção'
  if(s==='conferencia')return 'Conferência'
  if(s==='liberada')return 'Liberada'
  if(s==='cancelada')return 'Cancelada'
  return 'Aguardando'
}
function pronta(v?:string|null){
  return ['concluida','concluido','produzido','pronto','recebido'].includes(String(v||'').toLowerCase())
}
function badge(v?:string|null){
  const s=String(v||'').toLowerCase()
  if(pronta(s))return 'bg-emerald-100 text-emerald-700'
  if(s==='em_producao')return 'bg-blue-100 text-blue-700'
  if(s==='conferencia')return 'bg-violet-100 text-violet-700'
  if(s==='liberada')return 'bg-cyan-100 text-cyan-700'
  if(s==='cancelada')return 'bg-red-100 text-red-700'
  return 'bg-slate-100 text-slate-600'
}
function itemRef(item:any,idx:number){
  return String(item?.item_ref||item?.id||item?.ref||item?.uuid||idx+1)
}
function ambienteItem(item:any,idx:number){
  return String(item?.ambiente||item?.local||item?.descricao_curta||item?.configuracao_nome||item?.descricao||`Tipologia ${idx+1}`)
}
function descricaoItem(item:any){
  return String(item?.descricao||item?.tipo_esquadria||item?.tipologia_nome||item?.configuracao_nome||'Peça')
}

export default function VendaProducaoDetalhada({
  ordens,
  itens,
  statusGeral,
}:{
  ordens:Ordem[]
  itens:any[]
  statusGeral?:string|null
}){
  const mapaItens=new Map<string,{ambiente:string;descricao:string}>()
  ;(Array.isArray(itens)?itens:[]).forEach((item,idx)=>{
    mapaItens.set(itemRef(item,idx),{ambiente:ambienteItem(item,idx),descricao:descricaoItem(item)})
  })

  const linhas=ordens.map(o=>{
    const ref=String(o.item_ref||'')
    const vinculo=mapaItens.get(ref)
    const snap=o.item_snapshot||{}
    const ambiente=String(snap.ambiente||snap.local||vinculo?.ambiente||o.titulo||'Sem ambiente informado')
    const descricao=String(snap.descricao||snap.tipo_esquadria||vinculo?.descricao||o.titulo||'Peça')
    const qtd=Math.max(0,Number(o.quantidade||1))
    const produzida=pronta(o.status)?qtd:0
    const faltante=Math.max(0,qtd-produzida)
    return {...o,ambiente,descricao,qtd,produzida,faltante}
  })

  const total=linhas.reduce((s,x)=>s+x.qtd,0)
  const produzidas=linhas.reduce((s,x)=>s+x.produzida,0)
  const faltantes=Math.max(0,total-produzidas)
  const ambientes=[...new Set(linhas.map(x=>x.ambiente))]

  return <div className="space-y-4">
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      <div className="rounded-xl border bg-slate-50 p-4"><p className="text-[11px] font-bold uppercase text-slate-400">Ordens</p><p className="mt-1 text-2xl font-bold text-slate-900">{ordens.length}</p><p className="text-xs text-slate-500">{statusGeral||'Status geral não informado'}</p></div>
      <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4"><p className="text-[11px] font-bold uppercase text-emerald-600">Peças produzidas</p><p className="mt-1 text-2xl font-bold text-emerald-700">{produzidas}</p><p className="text-xs text-emerald-700">de {total} prevista(s)</p></div>
      <div className="rounded-xl border border-amber-200 bg-amber-50 p-4"><p className="text-[11px] font-bold uppercase text-amber-600">Peças faltantes</p><p className="mt-1 text-2xl font-bold text-amber-700">{faltantes}</p><p className="text-xs text-amber-700">{total?Math.round((faltantes/total)*100):0}% pendente</p></div>
      <div className="rounded-xl border border-blue-200 bg-blue-50 p-4"><p className="text-[11px] font-bold uppercase text-blue-600">Ambientes / tipologias</p><p className="mt-1 text-2xl font-bold text-blue-700">{ambientes.length}</p><p className="text-xs text-blue-700">com ordem de produção</p></div>
    </div>

    {ambientes.map(ambiente=>{
      const lista=linhas.filter(x=>x.ambiente===ambiente)
      const totalAmb=lista.reduce((s,x)=>s+x.qtd,0)
      const prodAmb=lista.reduce((s,x)=>s+x.produzida,0)
      return <section key={ambiente} className="overflow-hidden rounded-xl border bg-white">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b bg-slate-50 px-4 py-3">
          <div><b className="text-sm text-slate-900">{ambiente}</b><p className="text-[11px] text-slate-500">{prodAmb} produzida(s) de {totalAmb} · {Math.max(0,totalAmb-prodAmb)} faltante(s)</p></div>
          <div className="h-2 w-36 overflow-hidden rounded-full bg-slate-200"><div className="h-full bg-emerald-500" style={{width:`${totalAmb?Math.round((prodAmb/totalAmb)*100):0}%`}}/></div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] text-sm">
            <thead className="bg-white text-left text-[11px] uppercase tracking-wide text-slate-400"><tr><th className="px-4 py-2.5">Ordem / peça</th><th>Tipologia</th><th>Qtd.</th><th>Produzido</th><th>Falta</th><th>Medida</th><th>Status</th></tr></thead>
            <tbody>{lista.map(o=><tr key={o.id} className="border-t">
              <td className="px-4 py-3"><div className="flex items-center gap-2">{o.bloqueada?<AlertTriangle size={14} className="text-amber-500"/>:pronta(o.status)?<CheckCircle2 size={14} className="text-emerald-500"/>:<Clock3 size={14} className="text-slate-400"/>}<b className="text-slate-800">OP #{o.numero||'—'} · {o.titulo||o.descricao}</b></div>{o.bloqueada&&o.bloqueio_motivo&&<p className="mt-1 text-[10px] text-amber-700">{o.bloqueio_motivo}</p>}</td>
              <td className="py-3 text-slate-600">{o.descricao}</td>
              <td className="py-3 font-semibold">{o.qtd}</td>
              <td className="py-3 font-bold text-emerald-700">{o.produzida}</td>
              <td className="py-3 font-bold text-amber-700">{o.faltante}</td>
              <td className="py-3 text-slate-600">{o.largura_mm&&o.altura_mm?`${o.largura_mm} × ${o.altura_mm} mm`:'—'}</td>
              <td className="py-3"><span className={`rounded-full px-2 py-1 text-xs font-bold ${badge(o.status)}`}>{statusLabel(o.status)}</span></td>
            </tr>)}</tbody>
          </table>
        </div>
      </section>
    })}

    {!ordens.length&&<div className="rounded-xl border border-dashed p-8 text-center"><Factory className="mx-auto text-slate-300" size={34}/><p className="mt-2 text-sm text-slate-500">Ainda não existem ordens de produção para esta venda.</p><p className="mt-1 text-xs text-slate-400">Quando as ordens forem geradas, o Atlas mostrará aqui produzido x faltante por tipologia e ambiente sem alterar o Kanban principal.</p></div>}
  </div>
}