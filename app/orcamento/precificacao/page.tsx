'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, Calculator, Loader2, Search } from 'lucide-react'
import { supabase } from '@/lib/supabase'

function moeda(v:any){return Number(v||0).toLocaleString('pt-BR',{style:'currency',currency:'BRL'})}

export default function ListaPrecificacao(){
  const [itens,setItens]=useState<any[]>([]),[busca,setBusca]=useState(''),[carregando,setCarregando]=useState(true)
  useEffect(()=>{void carregar()},[])
  async function carregar(){setCarregando(true);const {data}=await supabase.from('orcamentos').select('id,numero,status,valor_estimado,custo_otimizado,created_at,clientes(id,nome)').order('created_at',{ascending:false}).limit(100);setItens(data||[]);setCarregando(false)}
  const q=busca.trim().toLowerCase();const lista=itens.filter(o=>!q||String(o.numero||'').includes(q)||String(o.clientes?.nome||'').toLowerCase().includes(q))
  return <main className="min-h-screen bg-slate-50 p-4 md:p-7"><div className="mx-auto max-w-5xl space-y-5"><header><Link href="/orcamento/novo" className="mb-2 inline-flex items-center gap-2 text-sm text-slate-500"><ArrowLeft size={16}/>Orçamentos</Link><div className="flex items-center gap-3"><Calculator className="text-emerald-600"/><div><h1 className="text-2xl font-bold">Otimização e Precificação</h1><p className="text-sm text-slate-500">Escolha um orçamento para revisar materiais, aproveitamento, sobra e margens.</p></div></div></header><div className="relative"><Search size={16} className="absolute left-3 top-3 text-slate-400"/><input value={busca} onChange={e=>setBusca(e.target.value)} placeholder="Buscar cliente ou número..." className="w-full rounded-xl border bg-white py-2.5 pl-9 pr-3 text-sm"/></div>{carregando?<div className="grid place-items-center p-12 text-slate-400"><Loader2 className="animate-spin"/></div>:<div className="divide-y overflow-hidden rounded-2xl border bg-white">{lista.map(o=><Link key={o.id} href={`/orcamento/${o.id}/precificacao`} className="flex flex-wrap items-center justify-between gap-3 px-5 py-4 hover:bg-slate-50"><div><div className="font-bold">#{o.numero||'—'} · {o.clientes?.nome||'Cliente'}</div><p className="text-xs text-slate-500">{o.status} · {new Date(o.created_at).toLocaleDateString('pt-BR')}</p></div><div className="text-right"><b className="text-emerald-700">{moeda(o.valor_estimado)}</b><p className="text-xs text-slate-400">custo otimizado {moeda(o.custo_otimizado)}</p></div></Link>)}{lista.length===0&&<p className="p-8 text-center text-sm text-slate-400">Nenhum orçamento encontrado.</p>}</div>}</div></main>
}
