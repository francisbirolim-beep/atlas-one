'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { AlertTriangle, Boxes, FileClock, Link2, Loader2, PackageCheck, PlusCircle, ReceiptText, WalletCards } from 'lucide-react'
import { tokenAtual } from '@/lib/auth'

type Resumo={totalNfs:number;totalItens:number;totalPendentes:number}
export default function ComprasPage(){
 const[resumo,setResumo]=useState<Resumo|null>(null);const[erro,setErro]=useState('')
 useEffect(()=>{carregar()},[])
 async function carregar(){try{const t=await tokenAtual();if(!t)return;const r=await fetch('/api/compras/nfs?limit=20',{headers:{Authorization:`Bearer ${t}`},cache:'no-store'});const j=await r.json();if(!r.ok)throw new Error(j.error||'Erro ao carregar Compras.');setResumo(j.resumo)}catch(e){setErro(e instanceof Error?e.message:'Erro ao carregar Compras.')}}
 return <main className="min-h-screen bg-slate-50 p-4 sm:p-6"><div className="mx-auto max-w-7xl space-y-5">
  <header><p className="text-xs font-semibold uppercase tracking-[.14em] text-slate-400">Operações • Compras</p><h1 className="mt-1 text-2xl font-bold text-slate-900">Central de Compras</h1><p className="mt-1 text-sm text-slate-600">NF → vínculo/cadastro → financeiro → recebimento → estoque, com rastreabilidade do arquivo original.</p></header>
  {erro&&<div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{erro}</div>}
  <section className="grid gap-3 sm:grid-cols-3"><ResumoCard label="Notas registradas" valor={resumo?.totalNfs} icon={<ReceiptText size={20}/>}/><ResumoCard label="Itens nas notas" valor={resumo?.totalItens} icon={<FileClock size={20}/>}/><ResumoCard label="Pendentes de vínculo" valor={resumo?.totalPendentes} destaque={Boolean(resumo?.totalPendentes)} icon={<AlertTriangle size={20}/>}/></section>
  <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3"><Acao href="/compras/entrada" icon={<PlusCircle size={28}/>} titulo="Nova entrada de NF" descricao="XML, PDF/DANFE ou lançamento manual, com tributos e parcelas."/><Acao href="/compras/notas" icon={<PackageCheck size={28}/>} titulo="Conferir recebimento" descricao="Compare NF x material recebido; o estoque entra somente após a conferência."/><Acao href="/compras/vinculos" icon={<Link2 size={28}/>} titulo="Itens pendentes" descricao="Associar códigos do fornecedor ao catálogo do Atlas." destaque={Boolean(resumo?.totalPendentes)}/><Acao href="/estoque" icon={<Boxes size={28}/>} titulo="Estoque" descricao="Saldo, custo médio e valor em estoque por produto."/><Acao href="/financeiro/contas-pagar" icon={<WalletCards size={28}/>} titulo="Contas a Pagar" descricao="Parcelas das NFs, vencimentos e baixa de pagamentos."/><Acao href="/compras/notas" icon={<FileClock size={28}/>} titulo="Histórico de NFs" descricao="Fiscal, itens, recebimentos e arquivo original da compra."/></section>
  {!resumo&&!erro?<div className="flex items-center gap-2 text-sm text-slate-500"><Loader2 size={16} className="animate-spin"/>Carregando Compras...</div>:null}
  <div className="rounded-2xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-900"><strong>Fluxo:</strong> confirmar a NF pode gerar Contas a Pagar; o saldo de estoque só é atualizado quando o recebimento físico é confirmado. Itens sem vínculo ou sem fator de conversão ficam pendentes e não geram saldo incorreto.</div>
 </div></main>
}
function ResumoCard({label,valor,icon,destaque=false}:{label:string;valor?:number;icon:React.ReactNode;destaque?:boolean}){return <div className={`rounded-2xl border bg-white p-5 shadow-sm ${destaque?'border-amber-300':'border-slate-200'}`}><div className="flex items-center justify-between text-slate-500"><span className="text-sm font-medium">{label}</span>{icon}</div><div className="mt-2 text-3xl font-bold">{valor??'—'}</div></div>}
function Acao({href,icon,titulo,descricao,destaque=false}:{href:string;icon:React.ReactNode;titulo:string;descricao:string;destaque?:boolean}){return <Link href={href} className={`rounded-2xl border bg-white p-6 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md ${destaque?'border-amber-300':'border-slate-200'}`}><div className="text-slate-700">{icon}</div><h2 className="mt-4 font-bold">{titulo}</h2><p className="mt-1 text-sm leading-6 text-slate-600">{descricao}</p></Link>}
