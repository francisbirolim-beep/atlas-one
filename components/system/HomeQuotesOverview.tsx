'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { ArrowUpRight, CircleDollarSign, FileCheck2, FileClock, FileText } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { formatarMoeda } from '@/lib/formatacao'

type Dados = { total:number; abertos:number; enviados:number; aprovados:number; valorAberto:number }

export default function HomeQuotesOverview() {
  const [dados,setDados]=useState<Dados>({total:0,abertos:0,enviados:0,aprovados:0,valorAberto:0})
  const [carregando,setCarregando]=useState(true)
  useEffect(()=>{ let ativo=true; supabase.from('orcamentos').select('status,valor_estimado').then(({data})=>{ if(!ativo)return; const lista=data||[]; const aberto=(s:string|null)=>!['aprovado','convertido','recusado','cancelado','vendido'].includes(s||''); setDados({total:lista.length,abertos:lista.filter(o=>aberto(o.status)).length,enviados:lista.filter(o=>o.status==='enviado').length,aprovados:lista.filter(o=>['aprovado','convertido','vendido'].includes(o.status||'')).length,valorAberto:lista.filter(o=>aberto(o.status)).reduce((s,o)=>s+Number(o.valor_estimado||0),0)}); setCarregando(false)}); return()=>{ativo=false}},[])
  const cards=[
    {label:'Em aberto',valor:dados.abertos,icon:FileClock},
    {label:'Enviados',valor:dados.enviados,icon:FileText},
    {label:'Aprovados / vendidos',valor:dados.aprovados,icon:FileCheck2},
    {label:'Valor em aberto',valor:formatarMoeda(dados.valorAberto),icon:CircleDollarSign},
  ]
  return <section className="mx-auto w-full max-w-7xl px-4 pt-4 md:px-6"><div className="mb-2 flex items-center justify-between"><div><h2 className="font-bold text-slate-900">Orçamentos</h2><p className="text-xs text-slate-500">Visão objetiva da carteira atual.</p></div><Link href="/orcamento/pesquisar" className="flex items-center gap-1 text-xs font-semibold text-brand-navy">Ver todos <ArrowUpRight size={13}/></Link></div><div className="grid grid-cols-2 gap-2 xl:grid-cols-4">{cards.map(card=>{const Icon=card.icon;return <Link href="/orcamento/pesquisar" key={card.label} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"><Icon size={18} className="text-slate-500"/><p className="mt-3 text-xs text-slate-500">{card.label}</p><p className="mt-1 text-xl font-bold text-slate-900">{carregando?'—':card.valor}</p></Link>})}</div></section>
}
