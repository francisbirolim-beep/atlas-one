'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useParams, useSearchParams } from 'next/navigation'
import { ArrowLeft, Loader2, Printer, Scissors } from 'lucide-react'
import { carregarPlanoCorteOrcamento, type PrecificacaoOrcamento } from '@/lib/orcamentoPrecificacao'

function n(v:unknown){const x=Number(v);return Number.isFinite(x)?x:0}
function mm(v:unknown){return `${Math.round(n(v)).toLocaleString('pt-BR')} mm`}

export default function PlanoCorteOrcamentoPage(){
  const params=useParams(); const sp=useSearchParams()
  const orcamentoId=String(params?.id||'')
  const refs=useMemo(()=>new Set((sp.get('refs')||'').split(',').filter(Boolean)),[sp])
  const [dados,setDados]=useState<PrecificacaoOrcamento|null>(null)
  const [carregando,setCarregando]=useState(true)
  useEffect(()=>{if(!orcamentoId)return;void carregarPlanoCorteOrcamento(orcamentoId).then(d=>{setDados(d);setCarregando(false)})},[orcamentoId])
  if(carregando)return <div className="grid min-h-screen place-items-center bg-slate-50"><Loader2 className="animate-spin"/></div>
  if(!dados)return <div className="grid min-h-screen place-items-center bg-slate-50">Orçamento não encontrado.</div>

  const cortes=(dados.cortes||[]).filter((c:any)=>!refs.size||refs.has(String(c.item_ref||'')))
  const barraIds=new Set(cortes.map((c:any)=>String(c.barra_id)))
  const barras=(dados.barras||[]).filter((b:any)=>!refs.size||barraIds.has(String(b.id)))
  const porBarra=new Map<string,any[]>()
  for(const c of cortes as any[]){const a=porBarra.get(String(c.barra_id))||[];a.push(c);porBarra.set(String(c.barra_id),a)}
  const labelRefs=refs.size?`${refs.size} tipologia(s) selecionada(s)`:'Orçamento inteiro'
  return <main className="min-h-screen bg-slate-50 p-4 md:p-7 print:bg-white print:p-0">
    <style jsx global>{`@page{size:A4 landscape;margin:10mm}@media print{.nao-imprimir{display:none!important}body{background:white!important}}`}</style>
    <div className="mx-auto max-w-7xl space-y-5">
      <header className="flex flex-wrap items-start justify-between gap-4 border-b pb-4"><div><Link href={`/orcamento/${orcamentoId}/composicao`} className="nao-imprimir mb-2 inline-flex items-center gap-2 text-sm text-slate-500"><ArrowLeft size={16}/> Voltar ao orçamento</Link><div className="flex items-center gap-2"><Scissors className="text-blue-600"/><h1 className="text-2xl font-bold">Plano de corte</h1></div><p className="text-sm text-slate-500">{labelRefs} · {barras.length} barra(s) · {cortes.length} corte(s){dados.pacote?.origem === 'medicao_final' ? ' · Medida Final' : ''}</p></div><button onClick={()=>window.print()} className="nao-imprimir inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2 text-sm font-bold text-white"><Printer size={16}/> Imprimir / PDF</button></header>
      <section className="grid gap-3 sm:grid-cols-3"><div className="rounded-xl border bg-white p-4"><p className="text-xs text-slate-400">Barras</p><p className="text-2xl font-bold">{barras.length}</p></div><div className="rounded-xl border bg-white p-4"><p className="text-xs text-slate-400">Cortes</p><p className="text-2xl font-bold">{cortes.length}</p></div><div className="rounded-xl border bg-white p-4"><p className="text-xs text-slate-400">Sobra total</p><p className="text-2xl font-bold">{mm(barras.reduce((s:number,b:any)=>s+n(b.sobra_final_mm),0))}</p></div></section>
      <div className="space-y-4">{barras.map((b:any,idx:number)=>{const cs=porBarra.get(String(b.id))||[];return <section key={b.id} className="rounded-2xl border bg-white p-4 print:break-inside-avoid"><div className="flex flex-wrap justify-between gap-2"><div><p className="text-xs uppercase text-slate-400">Barra {idx+1}</p><h2 className="font-bold">{b.codigo||b.produto_codigo||'Perfil'} · {b.descricao||''}</h2></div><div className="text-right text-sm"><b>{mm(b.comprimento_inicial_mm)}</b><p className="text-xs text-slate-500">Sobra {mm(b.sobra_final_mm)}</p></div></div><div className="mt-3 flex min-h-14 overflow-hidden rounded-xl border bg-slate-50">{cs.map((c:any,i:number)=>{const base=Math.max(1,n(b.comprimento_inicial_mm));const w=Math.max(5,(n(c.comprimento_mm)/base)*100);return <div key={c.id||i} style={{width:`${w}%`}} className="flex min-w-[80px] flex-col items-center justify-center border-r bg-blue-50 px-2 text-center text-[10px]"><b>{mm(c.comprimento_mm)}</b><span>{c.item_ref||'—'}</span></div>})}<div className="flex min-w-[70px] flex-1 items-center justify-center bg-amber-50 px-2 text-[10px]"><b>Sobra {mm(b.sobra_final_mm)}</b></div></div><div className="mt-3 overflow-x-auto"><table className="w-full text-xs"><thead className="text-left text-slate-400"><tr><th className="py-2">Item</th><th>Comprimento</th><th>Perda de corte</th><th>Observação</th></tr></thead><tbody>{cs.map((c:any,i:number)=><tr key={c.id||i} className="border-t"><td className="py-2">{c.item_ref||'—'}</td><td>{mm(c.comprimento_mm)}</td><td>{mm(c.perda_corte_mm)}</td><td>{c.observacao||'—'}</td></tr>)}</tbody></table></div></section>})}{!barras.length&&<div className="rounded-2xl border border-dashed bg-white p-10 text-center text-slate-400">Nenhuma barra/corte disponível para este escopo.</div>}</div>
    </div>
  </main>
}