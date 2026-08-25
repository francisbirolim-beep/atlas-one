'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, FilePlus2 } from 'lucide-react'
import { tokenAtual } from '@/lib/auth'
import BuscaAtlasInput from '@/components/system/BuscaAtlasInput'

type Orc={id:string;numero:number|null;cliente_nome:string;cliente_whatsapp?:string|null;valor_estimado?:number|null;status:string;created_at:string;condicoes?:string|null}
function moeda(n:number){return Number(n||0).toLocaleString('pt-BR',{style:'currency',currency:'BRL'})}

export default function OrcamentosBalcao(){
 const [q,setQ]=useState(''),[lista,setLista]=useState<Orc[]>([]),[erro,setErro]=useState(''),[carregando,setCarregando]=useState(false)
 const abort=useRef<AbortController|null>(null),seq=useRef(0)
 async function carregar(v=''){
  const atual=++seq.current;abort.current?.abort();const controller=new AbortController();abort.current=controller;setCarregando(true)
  try{const t=await tokenAtual();if(!t)throw new Error('Sessão expirada.');const r=await fetch(`/api/balcao/orcamentos?q=${encodeURIComponent(v)}`,{headers:{Authorization:`Bearer ${t}`},signal:controller.signal,cache:'no-store'});const j=await r.json();if(!r.ok)throw new Error(j.error);if(atual===seq.current)setLista(j.orcamentos||[])}catch(e){if((e as {name?:string})?.name!=='AbortError'&&atual===seq.current)setErro(e instanceof Error?e.message:'Erro ao carregar orçamentos.')}finally{if(atual===seq.current)setCarregando(false)}
 }
 useEffect(()=>{const h=setTimeout(()=>carregar(q.trim()),70);return()=>clearTimeout(h)},[q])
 return <main className="min-h-screen bg-slate-50 p-4 sm:p-6"><div className="mx-auto max-w-6xl space-y-4"><header className="flex flex-wrap items-center justify-between gap-3"><div className="flex items-center gap-3"><Link href="/balcao" className="rounded-lg border bg-white p-2"><ArrowLeft size={18}/></Link><div><p className="text-xs font-semibold uppercase tracking-[.15em] text-slate-400">Venda Balcão</p><h1 className="text-2xl font-bold">Orçamentos</h1><p className="text-sm text-slate-500">Orçamento não baixa estoque e não movimenta caixa.</p></div></div><Link href="/balcao/orcamentos/novo" className="inline-flex items-center gap-2 rounded-xl bg-emerald-700 px-4 py-2.5 text-sm font-semibold text-white"><FilePlus2 size={17}/>Novo orçamento</Link></header>{erro&&<div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{erro}</div>}<section className="rounded-2xl border bg-white p-4"><div className="flex items-end gap-3"><BuscaAtlasInput value={q} onValueChange={setQ} placeholder="Buscar em número, nome, apelido, CPF/CNPJ, telefone, cidade, bairro..." containerClassName="flex-1" inputClassName="w-full rounded-xl border py-2.5 pr-3 text-sm"/><span className="pb-2 text-xs text-slate-400">{carregando?'filtrando...':`${lista.length} resultado(s)`}</span></div><div className="mt-4 overflow-x-auto"><table className="w-full min-w-[760px] text-sm"><thead className="bg-slate-50 text-left text-xs text-slate-500"><tr><th className="p-3">Orçamento</th><th>Data</th><th>Cliente</th><th>Contato</th><th>Status</th><th>Valor</th></tr></thead><tbody>{lista.map(o=><tr key={o.id} className="border-t"><td className="p-3 font-bold">#{o.numero||'—'}</td><td>{new Date(o.created_at).toLocaleString('pt-BR')}</td><td>{o.cliente_nome}</td><td>{o.cliente_whatsapp||'—'}</td><td><span className="rounded-full bg-slate-100 px-2 py-1 text-xs">{o.status}</span></td><td className="font-bold text-emerald-700">{moeda(Number(o.valor_estimado||0))}</td></tr>)}</tbody></table>{!carregando&&!lista.length&&<div className="py-10 text-center text-sm text-slate-400">Nenhum orçamento encontrado.</div>}</div></section></div></main>
}
