'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { History, Plus, Search, ShoppingCart, WalletCards } from 'lucide-react'
import { tokenAtual } from '@/lib/auth'
import BuscaAtlasInput from '@/components/system/BuscaAtlasInput'
import { correspondeBuscaAtlas } from '@/lib/buscaAtlas'

type Venda={id:string;numero:number;status:string;atendimento_status?:string|null;cliente_nome?:string|null;vendedor_nome?:string|null;subtotal:number;desconto:number;total:number;finalizada_em:string}
function moeda(n:number){return Number(n||0).toLocaleString('pt-BR',{style:'currency',currency:'BRL'})}
function data(v:string){return new Date(v).toLocaleString('pt-BR',{dateStyle:'short',timeStyle:'short'})}
function statusTexto(v:string){const mapa:Record<string,string>={finalizada:'Finalizada',cancelada:'Cancelada',devolvida_parcial:'Parcialmente devolvida',entregue:'Entregue',aguardando_separacao:'Aguardando separação',aguardando_estoque:'Aguardando estoque',parcial:'Parcial'};return mapa[v]||v}

export default function VendasBalcao(){
 const [vendas,setVendas]=useState<Venda[]>([]),[busca,setBusca]=useState(''),[carregando,setCarregando]=useState(true),[erro,setErro]=useState('')
 async function carregar(){setCarregando(true);try{const t=await tokenAtual();if(!t)throw new Error('Sessão expirada.');const r=await fetch('/api/balcao/vendas',{headers:{Authorization:`Bearer ${t}`},cache:'no-store'});const j=await r.json();if(!r.ok)throw new Error(j.error);setVendas(j.vendas||[])}catch(e){setErro(e instanceof Error?e.message:'Não foi possível carregar as vendas.')}finally{setCarregando(false)}}
 useEffect(()=>{carregar()},[])
 const filtradas=busca.trim()?vendas.filter(v=>correspondeBuscaAtlas(busca,v.numero,v.cliente_nome,v.vendedor_nome,v.status,v.atendimento_status)):vendas
 return <main className="min-h-screen bg-slate-50 p-4"><div className="mx-auto max-w-7xl space-y-4">
  <header className="flex flex-wrap items-end justify-between gap-3"><div><p className="text-[10px] font-semibold uppercase tracking-[.15em] text-slate-400">Venda Balcão</p><h1 className="text-2xl font-bold text-slate-900">Vendas</h1><p className="mt-1 text-xs text-slate-500">Inicie uma nova venda ou consulte as vendas recentes.</p></div><div className="flex flex-wrap gap-2"><Link href="/balcao/consulta-preco" className="rounded-lg border bg-white px-3 py-2 text-xs font-semibold">Consulta de preço</Link><Link href="/balcao/caixa" className="inline-flex items-center gap-1.5 rounded-lg border bg-white px-3 py-2 text-xs font-semibold"><WalletCards size={14}/>Caixa</Link><Link href="/balcao/vendas/nova" className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-4 py-2 text-xs font-semibold text-white shadow-sm"><Plus size={15}/>Nova venda</Link></div></header>
  {erro&&<div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">{erro}</div>}
  <section className="rounded-2xl border bg-white p-4"><div className="mb-3 flex flex-wrap items-center justify-between gap-3"><div className="flex items-center gap-2"><ShoppingCart size={18} className="text-emerald-700"/><h2 className="font-semibold text-slate-800">Vendas recentes</h2></div><div className="w-full sm:w-96"><BuscaAtlasInput value={busca} onValueChange={setBusca} placeholder="Número, cliente, vendedor ou status..." inputClassName="w-full rounded-lg border py-2 pr-3 text-xs"/></div></div>{carregando?<div className="py-12 text-center text-sm text-slate-400">Carregando...</div>:filtradas.length===0?<div className="py-12 text-center text-sm text-slate-400">Nenhuma venda encontrada. Clique em <strong>Nova venda</strong> para começar.</div>:<div className="overflow-auto"><table className="w-full min-w-[820px] text-xs"><thead className="bg-slate-50 text-left text-[11px] text-slate-500"><tr><th className="p-2">Venda</th><th>Data</th><th>Cliente</th><th>Vendedor</th><th>Status</th><th>Atendimento</th><th className="text-right">Total</th><th/></tr></thead><tbody>{filtradas.map(v=><tr key={v.id} className="border-t"><td className="p-2 font-semibold">#{v.numero}</td><td>{data(v.finalizada_em)}</td><td>{v.cliente_nome||'Consumidor'}</td><td>{v.vendedor_nome||'—'}</td><td>{statusTexto(v.status)}</td><td><span className={v.atendimento_status==='aguardando_estoque'?'font-semibold text-amber-700':''}>{statusTexto(v.atendimento_status||'')}</span></td><td className="text-right font-semibold">{moeda(v.total)}</td><td className="text-right"><Link href={`/balcao/historico?id=${v.id}`} className="inline-flex items-center gap-1 text-emerald-700 hover:underline"><History size={12}/>Detalhes</Link></td></tr>)}</tbody></table></div>}</section>
 </div></main>
}
