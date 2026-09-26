'use client'
import { useEffect, useState } from 'react'
import { listarConversasAtendimento, listarMensagensAtendimento, buscarClienteAtendimento, observarAtendimento, type AtendimentoConversa, type AtendimentoCliente, type AtendimentoMensagem } from '@/lib/atendimento'

export default function AtendimentoPage(){
 const [conversas,setConversas]=useState<AtendimentoConversa[]>([])
 const [clientes,setClientes]=useState<Record<string,AtendimentoCliente|null>>({})
 const [erro,setErro]=useState('')
 const [mensagens,setMensagens]=useState<AtendimentoMensagem[]>([])
 const [rt,setRt]=useState('Iniciando segundo Realtime...')
 const [busca,setBusca]=useState('')
 useEffect(()=>{let ativo=true;(async()=>{try{const dados=await listarConversasAtendimento();if(!ativo)return;setConversas(dados);const ids=[...new Set(dados.map(x=>x.cliente_id).filter(Boolean))] as string[];const pares=await Promise.all(ids.map(async id=>[id,await buscarClienteAtendimento(id)] as const));if(ativo)setClientes(Object.fromEntries(pares))}catch(e){if(ativo)setErro(String(e))}})();const parar=observarAtendimento(()=>{});return()=>{ativo=false;parar()}},[])
 useEffect(()=>{const conversa=conversas[0];if(!conversa)return;let ativo=true;listarMensagensAtendimento(conversa.id).then(m=>{if(ativo)setMensagens(m)}).catch(e=>{if(ativo)setErro(String(e))});const parar=observarAtendimento(()=>setRt('Segundo Realtime recebeu atualização'));setRt('Dois canais Realtime únicos criados');return()=>{ativo=false;parar()}},[conversas[0]?.id])
 const filtradas=conversas.filter(c=>{const cl=c.cliente_id?clientes[c.cliente_id]:null;const q=busca.trim().toLowerCase();return !q||((cl?.nome||'')+' '+c.telefone).toLowerCase().includes(q)})
 return <main className="min-h-screen bg-slate-100 p-3"><div className="mx-auto max-w-5xl overflow-hidden rounded-2xl border bg-white shadow-sm">
  <header className="border-b p-4"><h1 className="text-xl font-bold">Central de Conversas</h1><p className="text-sm text-slate-500">Teste 9 · dois Realtime com canais únicos</p></header>
  <div className="p-4"><input value={busca} onChange={e=>setBusca(e.target.value)} placeholder="Buscar conversas..." className="w-full rounded-xl border px-4 py-3 text-sm outline-none"/>
   <div className="mt-5 rounded-xl border border-emerald-200 bg-emerald-50 p-4"><b className="text-emerald-900">Conversas: {conversas.length} · Mensagens: {mensagens.length}</b><p className="mt-2 text-sm text-emerald-800">{rt}</p>{erro&&<p className="mt-2 break-words text-sm text-red-700">{erro}</p>}</div>
   <div className="mt-4 divide-y rounded-xl border">{filtradas.map(c=>{const cl=c.cliente_id?clientes[c.cliente_id]:null;return <div key={c.id} className="p-4"><b>{cl?.nome||c.telefone}</b><p className="text-sm text-slate-500">{c.telefone} · {c.status}</p></div>})}{filtradas.length===0&&<p className="p-4 text-sm text-slate-500">Nenhuma conversa.</p>}</div>
  </div>
 </div></main>
}
