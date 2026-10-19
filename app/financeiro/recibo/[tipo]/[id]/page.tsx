'use client'
import {useEffect,useState} from 'react'
import {useParams} from 'next/navigation'
import Link from 'next/link'
import ReciboImpressao from '@/components/financeiro/ReciboImpressao'
import type {ReciboInfo} from '@/lib/financeiroRecibos'
import {tokenAtual} from '@/lib/auth'
export default function ReciboFinanceiroPage(){
 const params=useParams<{tipo:string;id:string}>()
 const [dados,setDados]=useState<ReciboInfo|null>(null),[loading,setLoading]=useState(true),[erro,setErro]=useState('')
 useEffect(()=>{
  let ativo=true
  async function carregar(){
   setLoading(true);setErro('')
   try{
    const token=await tokenAtual();if(!token)throw new Error('Sessão expirada.')
    const r=await fetch(`/api/financeiro/recibo?tipo=${encodeURIComponent(params.tipo)}&id=${encodeURIComponent(params.id)}`,{headers:{Authorization:`Bearer ${token}`},cache:'no-store'})
    const j=await r.json();if(!r.ok)throw new Error(j.error||'Erro ao carregar recibo.')
    if(ativo)setDados(j.recibo)
   }catch(e){if(ativo)setErro(e instanceof Error?e.message:'Erro ao carregar recibo.')}
   finally{if(ativo)setLoading(false)}
  }
  if(params.tipo&&params.id)void carregar()
  return ()=>{ativo=false}
 },[params.id,params.tipo])
 return <main className="min-h-screen bg-slate-100 p-4 sm:p-8 print:bg-white print:p-0">
  <div className="no-print mx-auto mb-3 max-w-[820px]"><Link className="text-sm font-semibold text-blue-700 underline" href={params.tipo==='pagar'?'/financeiro/contas-pagar':'/financeiro/contas-receber'}>← Voltar para o financeiro</Link></div>
  {loading?<p className="text-center text-sm text-slate-600">Carregando recibo...</p>:erro?<p role="alert" className="mx-auto max-w-[820px] rounded-xl bg-red-50 p-4 text-sm text-red-700">{erro}</p>:dados?<ReciboImpressao dados={dados}/>:<p>Recibo não encontrado.</p>}
 </main>
}
