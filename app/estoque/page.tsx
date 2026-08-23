'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { Boxes, Loader2, RefreshCw, Search } from 'lucide-react'
import { tokenAtual } from '@/lib/auth'

type Saldo={produto_id:string;unidade:string|null;quantidade:number;custo_medio:number|null;valor_estoque:number;updated_at:string;produto?:{id:string;codigo:string|null;nome:string;categoria:string}|null}
type Movimento={id:string;produto_id:string;tipo:string;quantidade:number;unidade:string|null;custo_unitario:number|null;valor_total:number|null;origem_tipo:string;criado_por_nome:string|null;created_at:string}
const moeda=(v:number|null|undefined)=>(Number(v)||0).toLocaleString('pt-BR',{style:'currency',currency:'BRL'})
export default function EstoquePage(){
 const[saldos,setSaldos]=useState<Saldo[]>([]);const[movs,setMovs]=useState<Movimento[]>([]);const[busca,setBusca]=useState('');const[loading,setLoading]=useState(true);const[erro,setErro]=useState('')
 async function carregar(){setLoading(true);setErro('');try{const t=await tokenAtual();if(!t)throw new Error('Sessão expirada.');const r=await fetch('/api/estoque?limit=500',{headers:{Authorization:`Bearer ${t}`},cache:'no-store'});const j=await r.json();if(!r.ok)throw new Error(j.error||'Erro');setSaldos(j.saldos||[]);setMovs(j.movimentos||[])}catch(e){setErro(e instanceof Error?e.message:'Erro ao carregar estoque.')}finally{setLoading(false)}}
 useEffect(()=>{carregar()},[])
 const filtrados=useMemo(()=>{const q=busca.trim().toUpperCase();return q?saldos.filter(s=>String(s.produto?.codigo||'').toUpperCase().includes(q)||String(s.produto?.nome||'').toUpperCase().includes(q)):saldos},[saldos,busca])
 const total=useMemo(()=>saldos.reduce((s,x)=>s+Number(x.valor_estoque||0),0),[saldos])
 return <main className="min-h-screen bg-slate-50 p-4 sm:p-6"><div className="mx-auto max-w-7xl space-y-5">
  <header className="flex flex-wrap items-center justify-between gap-3"><div><p className="text-xs font-semibold uppercase tracking-[.14em] text-slate-400">Operações • Estoque</p><h1 className="mt-1 text-2xl font-bold text-slate-900">Estoque</h1><p className="mt-1 text-sm text-slate-600">Entradas são geradas somente após a conferência física do recebimento.</p></div><div className="flex gap-2"><Link href="/compras" className="rounded-xl border bg-white px-4 py-2 text-sm font-semibold">Compras</Link><button onClick={carregar} className="rounded-xl border bg-white p-2.5"><RefreshCw size={18}/></button></div></header>
  {erro&&<div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{erro}</div>}
  <section className="grid gap-3 sm:grid-cols-3"><Card t="Produtos com saldo" v={saldos.length}/><Card t="Valor em estoque" v={moeda(total)}/><Card t="Movimentos recentes" v={movs.length}/></section>
  <section className="rounded-2xl border bg-white p-5"><div className="mb-4 flex items-center gap-2 rounded-xl border px-3 py-2"><Search size={17} className="text-slate-400"/><input value={busca} onChange={e=>setBusca(e.target.value)} className="w-full outline-none" placeholder="Buscar código ou produto..."/></div>{loading?<div className="py-12 text-center"><Loader2 className="mx-auto animate-spin"/></div>:<div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr className="border-b text-left text-slate-500"><th className="p-2">Código</th><th className="p-2">Produto</th><th className="p-2">Unidade</th><th className="p-2 text-right">Saldo</th><th className="p-2 text-right">Custo médio</th><th className="p-2 text-right">Valor</th></tr></thead><tbody>{filtrados.map(s=><tr key={s.produto_id} className="border-b last:border-0"><td className="p-2 font-mono">{s.produto?.codigo||'—'}</td><td className="p-2 font-medium">{s.produto?.nome||'Produto'}</td><td className="p-2">{s.unidade||'—'}</td><td className="p-2 text-right font-semibold">{Number(s.quantidade).toLocaleString('pt-BR')}</td><td className="p-2 text-right">{moeda(s.custo_medio)}</td><td className="p-2 text-right">{moeda(s.valor_estoque)}</td></tr>)}</tbody></table>{!filtrados.length&&<div className="py-10 text-center text-slate-500"><Boxes className="mx-auto mb-2"/>Nenhum saldo de estoque registrado.</div>}</div>}</section>
 </div></main>
}
function Card({t,v}:{t:string;v:string|number}){return <div className="rounded-2xl border bg-white p-5"><div className="text-sm text-slate-500">{t}</div><div className="mt-1 text-2xl font-bold">{v}</div></div>}
