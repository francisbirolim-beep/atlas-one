'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { CircleDollarSign, Loader2, WalletCards } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { usuarioAtual } from '@/lib/auth'

type Credito={
  id:string
  valor:number
  alocado:number
  saldo:number
  data_recebimento?:string|null
  forma?:string|null
  referencia?:string|null
}
function moeda(v:number){return Number(v||0).toLocaleString('pt-BR',{style:'currency',currency:'BRL'})}
function dataBR(v?:string|null){if(!v)return '—';const d=new Date(v.length===10?`${v}T12:00:00`:v);return Number.isNaN(d.getTime())?'—':d.toLocaleDateString('pt-BR')}

export default function VendaFinanceiroHaver({
  clienteId,vendaId,obraId,aReceber,onAtualizar,
}:{
  clienteId:string
  vendaId:string
  obraId?:string|null
  aReceber:number
  onAtualizar?:()=>Promise<void>|void
}){
  const [creditos,setCreditos]=useState<Credito[]>([])
  const [carregando,setCarregando]=useState(true)
  const [aplicando,setAplicando]=useState(false)
  const [erro,setErro]=useState('')
  const [msg,setMsg]=useState('')

  async function carregar(){
    setCarregando(true);setErro('')
    const rr=await supabase.from('financeiro_recebimentos')
      .select('id,valor,data_recebimento,forma,referencia,status')
      .eq('cliente_id',clienteId)
      .neq('status','cancelado')
      .order('data_recebimento',{ascending:true})
    if(rr.error){setErro(rr.error.message);setCarregando(false);return}
    const ids=(rr.data||[]).map((x:any)=>x.id)
    let alocacoes:any[]=[]
    if(ids.length){
      const ar=await supabase.from('financeiro_recebimento_alocacoes').select('recebimento_id,valor').in('recebimento_id',ids)
      if(ar.error){setErro(ar.error.message);setCarregando(false);return}
      alocacoes=ar.data||[]
    }
    const soma:Record<string,number>={}
    alocacoes.forEach(a=>{soma[a.recebimento_id]=(soma[a.recebimento_id]||0)+Number(a.valor||0)})
    setCreditos((rr.data||[]).map((r:any)=>{
      const valor=Number(r.valor||0);const alocado=soma[r.id]||0
      return {id:r.id,valor,alocado,saldo:Math.max(0,valor-alocado),data_recebimento:r.data_recebimento,forma:r.forma,referencia:r.referencia}
    }).filter((r:Credito)=>r.saldo>0.009))
    setCarregando(false)
  }
  useEffect(()=>{void carregar()},[clienteId])

  const creditoLivre=useMemo(()=>creditos.reduce((s,c)=>s+c.saldo,0),[creditos])

  async function usarCredito(){
    if(!obraId){setErro('Esta venda ainda não possui obra vinculada.');return}
    if(creditoLivre<=0.009){setErro('Este cliente não possui crédito livre para usar.');return}
    const limite=Math.min(creditoLivre,Math.max(0,aReceber))
    if(limite<=0.009){setErro('Esta venda não possui saldo a receber para aplicar crédito.');return}
    const entrada=window.prompt(`Quanto do haver deseja usar nesta obra? Disponível: ${moeda(creditoLivre)} · Saldo da venda: ${moeda(aReceber)}`,limite.toFixed(2).replace('.',','))
    if(entrada==null)return
    const valor=Number(String(entrada).replace(/\./g,'').replace(',','.'))
    if(!Number.isFinite(valor)||valor<=0){setErro('Informe um valor válido.');return}
    if(valor>limite+0.009){setErro(`O máximo que pode ser aplicado agora é ${moeda(limite)}.`);return}

    setAplicando(true);setErro('');setMsg('')
    const usuario=await usuarioAtual()
    let restante=valor
    for(const credito of creditos){
      if(restante<=0.009)break
      const aplicar=Math.min(restante,credito.saldo)
      const { error }=await supabase.rpc('alocar_recebimento_cliente_em_venda',{
        p_recebimento_id:credito.id,
        p_venda_obra_id:vendaId,
        p_valor:aplicar,
        p_usuario_id:usuario?.id||null,
        p_usuario_nome:usuario?.nome||null,
      })
      if(error){setAplicando(false);setErro(error.message||'Não foi possível aplicar o crédito.');await carregar();return}
      restante-=aplicar
    }
    setAplicando(false)
    setMsg(`${moeda(valor-restante)} de crédito aplicado nesta venda.`)
    await carregar()
    await onAtualizar?.()
  }

  return <div className="mt-5 rounded-2xl border border-emerald-200 bg-emerald-50/40 p-4">
    <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
      <div>
        <div className="flex items-center gap-2"><WalletCards size={18} className="text-emerald-700"/><b className="text-sm text-slate-900">Haver / crédito geral do cliente</b></div>
        <p className="mt-1 text-xs text-slate-600">Crédito livre é recebimento do cliente que ainda não foi usado em nenhuma obra. Ele pode ser aplicado nesta venda ou preservado para uma venda futura.</p>
      </div>
      <div className="text-right"><p className="text-[11px] font-bold uppercase text-slate-400">Crédito livre</p><p className="text-xl font-black text-emerald-700">{carregando?'…':moeda(creditoLivre)}</p></div>
    </div>
    {erro&&<div className="mt-3 rounded-lg border border-red-200 bg-red-50 p-2 text-xs text-red-700">{erro}</div>}
    {msg&&<div className="mt-3 rounded-lg border border-emerald-200 bg-emerald-50 p-2 text-xs text-emerald-700">{msg}</div>}
    <div className="mt-3 flex flex-wrap gap-2">
      <button disabled={carregando||aplicando||creditoLivre<=0.009||!obraId||aReceber<=0.009} onClick={()=>void usarCredito()} className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-2 text-xs font-bold text-white disabled:opacity-40">{aplicando?<Loader2 size={13} className="animate-spin"/>:<CircleDollarSign size={13}/>}Usar crédito nesta obra</button>
      <Link href={`/clientes/${clienteId}`} className="rounded-lg border bg-white px-3 py-2 text-xs font-bold text-slate-700">Abrir Cliente 360</Link>
    </div>
    {creditos.length>0&&<div className="mt-3 space-y-2">{creditos.slice(0,5).map(c=><div key={c.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-emerald-100 bg-white px-3 py-2 text-xs"><span>{dataBR(c.data_recebimento)} · {c.forma||'Forma não informada'}{c.referencia?` · ${c.referencia}`:''}</span><b className="text-emerald-700">{moeda(c.saldo)} livre</b></div>)}</div>}
  </div>
}