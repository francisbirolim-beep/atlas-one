'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, Search } from 'lucide-react'
import { tokenAtual } from '@/lib/auth'

type EstoqueRede={localId:string;unidadeNome:string;localNome:string;fisico:number;reservado:number;disponivel:number;unidade:string}
type Produto={id:string;codigo:string;nome:string;descricao?:string|null;unidade:string;estoque:number;estoqueLocal:number;estoqueRede:number;estoquesRede:EstoqueRede[];unidadeEstoque:string;preco:number;precoPromocional?:number|null;precoEfetivo:number;custo?:number|null;margem?:number|null;precoMinimo?:number|null}
type LocalAtual={id:string;unidadeNome:string;nome:string}

function moeda(n:number){return Number(n||0).toLocaleString('pt-BR',{style:'currency',currency:'BRL'})}

export default function ConsultaPreco(){
 const [q,setQ]=useState(''),[lista,setLista]=useState<Produto[]>([]),[gestao,setGestao]=useState(false),[local,setLocal]=useState<LocalAtual|null>(null),[erro,setErro]=useState(''),[carregando,setCarregando]=useState(false)
 async function carregar(v=''){
  try{
   setCarregando(true);setErro('')
   const t=await tokenAtual();if(!t)throw new Error('Sessão expirada.')
   const r=await fetch(`/api/balcao/catalogo?tipo=produtos&q=${encodeURIComponent(v)}`,{headers:{Authorization:`Bearer ${t}`},cache:'no-store'})
   const j=await r.json();if(!r.ok)throw new Error(j.error)
   setLista(j.produtos||[]);setGestao(!!j.podeVerGestao);setLocal(j.localAtual||null)
  }catch(e){setErro(e instanceof Error?e.message:'Erro ao consultar produtos.')}finally{setCarregando(false)}
 }
 useEffect(()=>{carregar('')},[])
 useEffect(()=>{const h=setTimeout(()=>carregar(q),250);return()=>clearTimeout(h)},[q])
 const pesquisou=q.trim().length>=2
 return <main className="min-h-screen bg-slate-50 p-3 sm:p-4"><div className="mx-auto max-w-7xl space-y-3">
  <header className="flex items-center gap-3"><Link href="/balcao" className="rounded-lg border bg-white p-2"><ArrowLeft size={18}/></Link><div><p className="text-[10px] font-semibold uppercase tracking-[.15em] text-slate-400">Venda Balcão</p><h1 className="text-xl font-bold">Consulta de preço e estoque</h1><p className="text-xs text-slate-500">Pesquise com várias palavras, por exemplo: <strong>suprema roldana</strong>.</p></div></header>
  {local&&<div className="rounded-lg border border-sky-200 bg-sky-50 px-3 py-2 text-xs text-sky-900">Consultando como <strong>{local.unidadeNome}</strong> • {local.nome}. O estoque das demais unidades aparece ao lado.</div>}
  {erro&&<div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">{erro}</div>}
  <section className="rounded-xl border bg-white p-3"><div className="relative"><Search size={17} className="absolute left-3 top-2.5 text-slate-400"/><input autoFocus value={q} onChange={e=>setQ(e.target.value)} placeholder="Ex.: SUPREMA ROLDANA, SU 039, puxador preto..." className="w-full rounded-lg border py-2 pl-10 pr-3 text-sm"/></div>
   {!pesquisou?<div className="py-10 text-center text-sm text-slate-400">Digite pelo menos 2 caracteres para pesquisar.</div>:carregando?<div className="py-10 text-center text-sm text-slate-400">Pesquisando...</div>:lista.length===0?<div className="py-10 text-center text-sm text-slate-400">Nenhum produto encontrado com todos os termos informados.</div>:<div className="mt-3 max-h-[70vh] overflow-auto"><table className="w-full min-w-[920px] text-xs"><thead className="sticky top-0 z-10 bg-slate-50 text-left text-[11px] text-slate-500"><tr><th className="p-2">Produto</th><th>Nesta unidade</th><th>Total rede</th><th>Outras unidades</th><th>Preço normal</th><th>Preço atual</th>{gestao&&<><th>Custo</th><th>Margem</th><th>Mínimo</th></>}</tr></thead><tbody>{lista.map(p=><tr key={p.id} className="border-t align-top"><td className="p-2"><strong>{p.codigo||'—'}</strong><div className="leading-tight">{p.nome}</div>{p.descricao&&<div className="max-w-md truncate text-[10px] text-slate-400">{p.descricao}</div>}</td><td className="pt-2"><span className={p.estoqueLocal>0?'font-semibold text-emerald-700':'text-red-600'}>{p.estoqueLocal} {p.unidadeEstoque}</span></td><td className="pt-2 font-semibold text-sky-700">{p.estoqueRede} {p.unidadeEstoque}</td><td className="max-w-sm p-2"><div className="space-y-1">{p.estoquesRede.filter(e=>e.localId!==local?.id&&e.disponivel>0).map(e=><div key={e.localId} className="rounded bg-slate-50 px-2 py-1 text-[10px]"><strong>{e.unidadeNome}</strong> • {e.localNome}: <span className="text-emerald-700">{e.disponivel} {e.unidade}</span>{e.reservado>0&&<span className="ml-2 text-amber-600">({e.reservado} reservado)</span>}</div>)}{!p.estoquesRede.some(e=>e.localId!==local?.id&&e.disponivel>0)&&<span className="text-[10px] text-slate-400">Sem saldo em outra unidade</span>}</div></td><td className="pt-2">{moeda(p.preco)}</td><td className="pt-2"><strong className="text-emerald-700">{moeda(p.precoEfetivo)}</strong>{p.precoPromocional!=null&&<div className="text-[9px] text-amber-600">promocional</div>}</td>{gestao&&<><td className="pt-2">{p.custo==null?'—':moeda(p.custo)}</td><td className="pt-2">{p.margem==null?'—':`${p.margem.toFixed(1)}%`}</td><td className="pt-2">{p.precoMinimo==null?'—':moeda(p.precoMinimo)}</td></>}</tr>)}</tbody></table></div>}
  </section>
 </div></main>
}
