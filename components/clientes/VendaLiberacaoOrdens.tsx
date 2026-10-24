'use client'

import { useCallback, useEffect, useState } from 'react'
import { AlertTriangle, CheckCircle2, Loader2, RefreshCw, ShieldCheck } from 'lucide-react'
import { tokenAtual } from '@/lib/auth'

type Situacao={
  ok:boolean
  prontidao:boolean
  podeLiberar:boolean
  liberacaoPermitida:boolean
  pendencias:string[]
  ordensElegiveis:string[]
  jaLiberadas:number
  totais:{medicoes:number;materiais:number;materiaisPendentes:number;comprasPendentes:number;ordens:number;ordensBloqueadas:number}
}
export default function VendaLiberacaoOrdens({vendaId,onAtualizar}:{
  vendaId:string;onAtualizar?:()=>Promise<void>|void
}){
  const [situacao,setSituacao]=useState<Situacao|null>(null)
  const [carregando,setCarregando]=useState(true)
  const [liberando,setLiberando]=useState(false)
  const [erro,setErro]=useState('')
  const [mensagem,setMensagem]=useState('')

  const carregar=useCallback(async()=>{
    setCarregando(true);setErro('')
    try{
      const token=await tokenAtual()
      if(!token)throw new Error('Sessão expirada. Entre novamente.')
      const resp=await fetch('/api/producao/ordens/liberacao-venda?vendaId='+encodeURIComponent(vendaId),{
        cache:'no-store',headers:{Authorization:'Bearer '+token}
      })
      const json=await resp.json().catch(()=>({}))
      if(!resp.ok)throw new Error(json.error||'Falha ao avaliar a produção.')
      setSituacao(json as Situacao)
    }catch(e){
      setSituacao(null)
      setErro(e instanceof Error?e.message:'Não foi possível verificar a produção.')
    }finally{setCarregando(false)}
  },[vendaId])

  useEffect(()=>{void carregar()},[carregar])

  async function liberar(){
    if(!situacao?.podeLiberar||!situacao.liberacaoPermitida||liberando)return
    const n=situacao.ordensElegiveis.length
    if(!window.confirm('Liberar '+n+' ordem(ns) de esquadria desta venda? O Atlas vai conferir novamente a Medição Final, o pacote técnico e os materiais antes de desbloquear as ordens.'))return
    setLiberando(true);setErro('');setMensagem('')
    try{
      const token=await tokenAtual()
      if(!token)throw new Error('Sessão expirada.')
      const resp=await fetch('/api/producao/ordens/liberacao-venda',{
        method:'POST',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},
        body:JSON.stringify({vendaId,confirmar:true}),
      })
      const json=await resp.json().catch(()=>({}))
      if(!resp.ok){
        const detalhes=Array.isArray(json.pendencias)?' '+json.pendencias.join(' · '):''
        throw new Error((json.error||'Liberação não autorizada.')+detalhes)
      }
      setMensagem(String(json.liberadas||0)+' ordem(ns) liberadas. Confira o Kanban e o plano de corte.')
      await carregar()
      await onAtualizar?.()
    }catch(e){setErro(e instanceof Error?e.message:'Falha ao liberar a produção.')}
    finally{setLiberando(false)}
  }

  return <section id="atlas-conferencia-liberacao-venda" className="mb-5 scroll-mt-24 rounded-xl border border-slate-200 bg-slate-50 p-4">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div className="flex items-start gap-2">
        <ShieldCheck size={20} className="mt-0.5 text-blue-700"/>
        <div><h3 className="text-sm font-bold text-slate-900">Conferência para liberar as ordens</h3>
          <p className="mt-1 text-xs text-slate-600">Só desbloqueia ordens de esquadria preparadas desta venda. Contramarcos e ordens manuais permanecem inalterados.</p>
        </div>
      </div>
      <button type="button" disabled={carregando||liberando} onClick={()=>void carregar()}
        className="inline-flex items-center gap-1 rounded-lg border bg-white px-3 py-2 text-xs font-bold text-slate-700 disabled:opacity-50">
        <RefreshCw size={13}/> Conferir novamente
      </button>
    </div>
    {carregando?<p className="mt-3 inline-flex items-center gap-2 text-xs text-slate-500"><Loader2 size={14} className="animate-spin"/>Verificando Medição Final, materiais e ordens...</p>:null}
    {erro&&<p role="alert" className="mt-3 rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-700">{erro}</p>}
    {mensagem&&<p role="status" className="mt-3 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-800">{mensagem}</p>}
    {situacao&&!carregando&&<>
      <div className="mt-3 flex items-center gap-2 text-xs">
        {situacao.prontidao?<CheckCircle2 size={15} className="text-emerald-700"/>:<AlertTriangle size={15} className="text-amber-700"/>}
        <b className={situacao.prontidao?'text-emerald-700':'text-amber-800'}>
          {situacao.prontidao?'Requisitos operacionais conferidos':'Liberação bloqueada até resolver pendências'}
        </b>
      </div>
      <p className="mt-2 text-xs text-slate-600">{situacao.totais.medicoes} medição(ões) · {situacao.totais.materiais} materiais · {situacao.totais.ordens} ordens vinculadas · {situacao.jaLiberadas} já liberadas</p>
      {situacao.pendencias.length>0&&<ul className="mt-3 list-disc space-y-1 pl-5 text-xs text-amber-900">{situacao.pendencias.map((p,i)=><li key={i}>{p}</li>)}</ul>}
      <div className="mt-3 flex flex-wrap items-center gap-3">
        {situacao.liberacaoPermitida&&<button type="button"
          disabled={!situacao.podeLiberar||liberando}
          onClick={()=>void liberar()}
          className="inline-flex items-center gap-2 rounded-lg bg-emerald-700 px-3 py-2 text-xs font-bold text-white disabled:cursor-not-allowed disabled:opacity-40">
          {liberando?<Loader2 size={14} className="animate-spin"/>:<CheckCircle2 size={14}/>}
          Liberar {situacao.ordensElegiveis.length} ordem(ns) verificadas
        </button>}
        {!situacao.liberacaoPermitida&&<span className="text-xs text-slate-500">Liberação operacional restrita a usuários autorizados pelo Master.</span>}
        {situacao.prontidao&&!situacao.ordensElegiveis.length&&<span className="text-xs text-emerald-700">Não há ordens bloqueadas elegíveis. Nenhum lançamento será duplicado.</span>}
      </div>
      <p className="mt-2 text-[11px] text-slate-500">A verificação consulta os dados atuais no servidor. Ação somente mediante confirmação, sem criar compras, medições ou novas ordens.</p>
    </>}
  </section>
}
