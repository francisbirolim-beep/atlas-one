'use client'

import { useEffect, useRef, useState } from 'react'
import { BellRing, Clock3, Eye, X } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { usuarioAtual } from '@/lib/auth'
import { adiarEquipe, avisarMudancaEquipe, listarEquipe, type EquipeTarefa } from '@/lib/tarefasEquipeCliente'

export default function TarefaEquipeToast(){
  const router=useRouter()
  const [usuarioId,setUsuarioId]=useState<string|null>(null)
  const [tarefa,setTarefa]=useState<EquipeTarefa|null>(null)
  const [adiar,setAdiar]=useState<'15'|'60'|'240'|'amanha'>('60')
  const [ocupado,setOcupado]=useState(false)
  const atualRef=useRef<string|null>(null)
  const carregandoRef=useRef(false)
  useEffect(()=>{
    let ativo=true
    void usuarioAtual().then(u=>{if(ativo)setUsuarioId(u?.id||null)})
    return()=>{ativo=false}
  },[])
  useEffect(()=>{
    if(!usuarioId)return
    let ativo=true
    async function atualizar(){
      if(!ativo||carregandoRef.current||!navigator.onLine)return
      carregandoRef.current=true
      try{
        const dados=await listarEquipe()
        if(!ativo)return
        const agora=Date.now()
        const candidatas=dados.filter(t=>t.status!=='concluido'&&t.responsaveis_ids.includes(usuarioId!)&&
          Boolean(t.aviso?.proximo_aviso_em)&&new Date(t.aviso!.proximo_aviso_em).getTime()<=agora)
          .sort((a,b)=>new Date(a.aviso!.proximo_aviso_em).getTime()-new Date(b.aviso!.proximo_aviso_em).getTime())
        if(atualRef.current&&!candidatas.some(t=>t.id===atualRef.current)){
          atualRef.current=null;setTarefa(null)
        }
        if(!atualRef.current&&candidatas.length){
          atualRef.current=candidatas[0].id
          setTarefa(candidatas[0])
        }
      }catch(e){console.error('Falha ao consultar lembretes compartilhados:',e)}
      finally{carregandoRef.current=false}
    }
    void atualizar()
    const intervalo=window.setInterval(()=>{if(document.visibilityState==='visible')void atualizar()},30000)
    const aoAtualizar=()=>void atualizar()
    window.addEventListener('atlas:tarefas-equipe-atualizadas',aoAtualizar)
    window.addEventListener('focus',aoAtualizar)
    return()=>{ativo=false;window.clearInterval(intervalo);window.removeEventListener('atlas:tarefas-equipe-atualizadas',aoAtualizar);window.removeEventListener('focus',aoAtualizar)}
  },[usuarioId])
  async function acao(tipo:'ok'|'ver'|'15'|'60'|'240'|'amanha'){
    if(!tarefa||ocupado)return
    setOcupado(true)
    try{
      await adiarEquipe(tarefa.id,tipo)
      const id=tarefa.id
      atualRef.current=null;setTarefa(null)
      avisarMudancaEquipe()
      if(tipo==='ver'){
        if(window.location.pathname==='/')
          window.dispatchEvent(new CustomEvent('atlas:abrir-tarefa-equipe',{detail:{id}}))
        else router.push('/?tarefa='+encodeURIComponent(id))
      }
    }catch(e){window.alert(e instanceof Error?e.message:'Não foi possível adiar o aviso')}
    finally{setOcupado(false)}
  }
  if(!tarefa)return null
  const nova=Date.now()-new Date(tarefa.created_at).getTime()<3*60*60*1000
  return(
    <aside role="status" aria-live="polite" aria-label="Nova tarefa compartilhada" className="fixed bottom-4 right-3 z-[118] w-[min(calc(100vw-24px),390px)] rounded-2xl border border-violet-200 bg-slate-900 p-3 text-white shadow-2xl sm:bottom-6 sm:right-6">
      <div className="flex items-start gap-2.5">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-violet-600 text-white"><BellRing size={19}/></span>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-bold">{nova?'Você recebeu uma nova tarefa!':'Lembrete de tarefa pendente'}</p>
          <p className="mt-1 truncate text-sm font-semibold" title={tarefa.titulo}>{tarefa.titulo}</p>
          <p className="mt-0.5 text-[11px] text-slate-300">Enviada por: {tarefa.criador_nome} · Prioridade: {tarefa.prioridade}</p>
          <p className="mt-0.5 flex items-center gap-1 text-[11px] text-slate-300"><Clock3 size={12}/>Prazo: {tarefa.data_hora?new Intl.DateTimeFormat('pt-BR',{day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'}).format(new Date(tarefa.data_hora)):'Sem prazo'}</p>
        </div>
        <button type="button" disabled={ocupado} onClick={()=>void acao('ok')} aria-label="Entendi, fechar aviso por enquanto" className="rounded p-1 text-slate-300 hover:bg-slate-800"><X size={16}/></button>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-1.5">
        <button type="button" disabled={ocupado} onClick={()=>void acao('ver')} className="inline-flex items-center gap-1 rounded-lg bg-blue-600 px-2.5 py-2 text-[11px] font-semibold hover:bg-blue-700"><Eye size={12}/>Ver tarefa</button>
        <button type="button" disabled={ocupado} onClick={()=>void acao('ok')} className="rounded-lg bg-emerald-600 px-2.5 py-2 text-[11px] font-semibold hover:bg-emerald-700">OK, entendi</button>
        <select value={adiar} onChange={e=>setAdiar(e.target.value as typeof adiar)} aria-label="Adiar lembrete" className="min-w-0 flex-1 rounded-lg bg-slate-700 px-1 py-2 text-[11px]">
          <option value="15">15 minutos</option><option value="60">1 hora</option><option value="240">4 horas</option><option value="amanha">Amanhã às 9h</option>
        </select>
        <button type="button" disabled={ocupado} onClick={()=>void acao(adiar)} className="rounded-lg bg-slate-600 px-2.5 py-2 text-[11px] font-semibold hover:bg-slate-500">Adiar</button>
      </div>
    </aside>
  )
}
