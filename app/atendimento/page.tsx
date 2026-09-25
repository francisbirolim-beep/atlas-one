'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

export default function AtendimentoPage() {
  const [busca,setBusca]=useState('')
  const [filtro,setFiltro]=useState('Todas')
  const [status,setStatus]=useState('Conectando ao Supabase...')
  useEffect(()=>{let ativo=true;supabase.from('atendimento_conversas').select('id',{count:'exact',head:true}).then(({count,error})=>{if(!ativo)return;setStatus(error?'Supabase respondeu com erro controlado: '+error.message:'Supabase conectado · '+(count??0)+' conversa(s)')}).catch(e=>{if(ativo)setStatus('Falha controlada: '+String(e))});return()=>{ativo=false}},[])
  return <main className="min-h-screen bg-slate-100 p-3"><div className="mx-auto max-w-5xl overflow-hidden rounded-2xl border bg-white shadow-sm">
    <header className="border-b p-4"><h1 className="text-xl font-bold">Central de Conversas</h1><p className="text-sm text-slate-500">Teste 3 · React + Supabase</p></header>
    <div className="flex gap-2 overflow-x-auto border-b p-3">{['Todas','Aguardando','Em atendimento','Finalizadas'].map(item=><button key={item} onClick={()=>setFiltro(item)} className={'whitespace-nowrap rounded-xl px-3 py-2 text-xs font-bold '+(filtro===item?'bg-emerald-100 text-emerald-800':'bg-slate-100 text-slate-600')}>{item}</button>)}</div>
    <div className="p-4"><input value={busca} onChange={e=>setBusca(e.target.value)} placeholder="Buscar conversas..." className="w-full rounded-xl border px-4 py-3 text-sm outline-none"/><div className="mt-6 rounded-xl border border-blue-200 bg-blue-50 p-4"><b className="text-blue-900">Camada Supabase</b><p className="mt-1 break-words text-sm text-blue-800">{status}</p></div></div>
  </div></main>
}
